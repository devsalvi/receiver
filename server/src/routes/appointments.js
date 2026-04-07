import { Router } from 'express';
import db from '../db/index.js';
import { v4 as uuid } from 'uuid';
import { createGoogleCalendarEvent, deleteGoogleCalendarEvent } from '../services/calendar.js';
import { sendConfirmationSMS } from '../services/sms.js';
import { scheduleReminders } from '../services/reminders.js';

const router = Router();

// List appointments with filters
router.get('/', (req, res) => {
  const storeId = req.storeId;
  const { status, from, to, barber_id, limit = 50, offset = 0 } = req.query;
  let query = `
    SELECT a.*, c.first_name as customer_name, c.phone as customer_phone,
           s.name as service_name, s.duration_minutes, s.price_cents,
           b.name as barber_name
    FROM appointments a
    LEFT JOIN customers c ON a.customer_id = c.id
    LEFT JOIN services s ON a.service_id = s.id
    LEFT JOIN barbers b ON a.barber_id = b.id
    WHERE a.store_id = ?
  `;
  const params = [storeId];

  if (status) { query += ' AND a.status = ?'; params.push(status); }
  if (from) { query += ' AND a.start_time >= ?'; params.push(from); }
  if (to) { query += ' AND a.start_time <= ?'; params.push(to); }
  if (barber_id) { query += ' AND a.barber_id = ?'; params.push(barber_id); }

  query += ' ORDER BY a.start_time ASC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const appointments = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM appointments WHERE store_id = ?').get(storeId).count;
  res.json({ appointments, total });
});

// Get single appointment
router.get('/:id', (req, res) => {
  const apt = db.prepare(`
    SELECT a.*, c.first_name as customer_name, c.phone as customer_phone,
           s.name as service_name, s.duration_minutes, s.price_cents,
           b.name as barber_name
    FROM appointments a
    LEFT JOIN customers c ON a.customer_id = c.id
    LEFT JOIN services s ON a.service_id = s.id
    LEFT JOIN barbers b ON a.barber_id = b.id
    WHERE a.id = ? AND a.store_id = ?
  `).get(req.params.id, req.storeId);

  if (!apt) return res.status(404).json({ error: 'Appointment not found' });
  res.json(apt);
});

// Create appointment
router.post('/', async (req, res) => {
  try {
    const storeId = req.storeId;
    const { customer_name, customer_phone, barber_id, service_id, start_time, notes } = req.body;

    if (!customer_name || !customer_phone || !start_time) {
      return res.status(400).json({ error: 'customer_name, customer_phone, and start_time are required' });
    }

    // Find or create customer scoped to store
    let customer = db.prepare('SELECT * FROM customers WHERE phone = ? AND store_id = ?').get(customer_phone, storeId);
    if (!customer) {
      const customerId = uuid();
      db.prepare('INSERT INTO customers (id, store_id, first_name, phone) VALUES (?, ?, ?, ?)')
        .run(customerId, storeId, customer_name, customer_phone);
      customer = { id: customerId, first_name: customer_name, phone: customer_phone };
    }

    // Get service for duration
    const service = service_id ? db.prepare('SELECT * FROM services WHERE id = ? AND store_id = ?').get(service_id, storeId) : null;
    const durationMinutes = service ? service.duration_minutes : 30;
    const endTime = new Date(new Date(start_time).getTime() + durationMinutes * 60000).toISOString();

    // Resolve barber ID — use store's default if not specified
    const defaultBarber = db.prepare("SELECT id FROM barbers WHERE store_id = ? AND name = 'Any Available'").get(storeId);
    const resolvedBarberId = barber_id || defaultBarber?.id || 'barber_default';

    // Check for conflicts
    const conflict = db.prepare(`
      SELECT id FROM appointments
      WHERE store_id = ? AND barber_id = ? AND status = 'confirmed'
      AND start_time < ? AND end_time > ?
    `).get(storeId, resolvedBarberId, endTime, start_time);

    if (conflict) {
      return res.status(409).json({ error: 'Time slot is not available' });
    }

    const appointmentId = uuid();
    db.prepare(`
      INSERT INTO appointments (id, store_id, customer_id, barber_id, service_id, start_time, end_time, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(appointmentId, storeId, customer.id, resolvedBarberId, service_id, start_time, endTime, notes);

    // Sync to Google Calendar
    try {
      const eventId = await createGoogleCalendarEvent({
        summary: `${customer_name} - ${service ? service.name : 'Appointment'}`,
        start: start_time,
        end: endTime,
        description: `Customer: ${customer_name}\nPhone: ${customer_phone}\n${notes || ''}`
      });
      if (eventId) {
        db.prepare('UPDATE appointments SET google_event_id = ? WHERE id = ?').run(eventId, appointmentId);
      }
    } catch (err) {
      console.error('Google Calendar sync failed:', err.message);
    }

    // Send SMS confirmation
    const store = db.prepare('SELECT name FROM stores WHERE id = ?').get(storeId);
    try {
      await sendConfirmationSMS(customer_phone, {
        customerName: customer_name,
        serviceName: service ? service.name : 'Appointment',
        startTime: start_time,
        businessName: store?.name
      }, storeId);
    } catch (err) {
      console.error('SMS confirmation failed:', err.message);
    }

    // Schedule reminders
    scheduleReminders(appointmentId, start_time);

    const appointment = db.prepare(`
      SELECT a.*, c.first_name as customer_name, c.phone as customer_phone,
             s.name as service_name, b.name as barber_name
      FROM appointments a
      LEFT JOIN customers c ON a.customer_id = c.id
      LEFT JOIN services s ON a.service_id = s.id
      LEFT JOIN barbers b ON a.barber_id = b.id
      WHERE a.id = ?
    `).get(appointmentId);

    res.status(201).json(appointment);
  } catch (err) {
    console.error('Create appointment error:', err);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Update appointment status
router.patch('/:id', async (req, res) => {
  const { status, start_time, notes } = req.body;
  const apt = db.prepare('SELECT * FROM appointments WHERE id = ? AND store_id = ?').get(req.params.id, req.storeId);
  if (!apt) return res.status(404).json({ error: 'Appointment not found' });

  const updates = [];
  const params = [];

  if (status) { updates.push('status = ?'); params.push(status); }
  if (start_time) { updates.push('start_time = ?'); params.push(start_time); }
  if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
  updates.push('updated_at = CURRENT_TIMESTAMP');

  params.push(req.params.id);
  db.prepare(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  if (status === 'cancelled' && apt.google_event_id) {
    try { await deleteGoogleCalendarEvent(apt.google_event_id); } catch (err) {
      console.error('Failed to delete calendar event:', err.message);
    }
  }

  const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Get availability for a date
router.get('/availability/:date', (req, res) => {
  const storeId = req.storeId;
  const { date } = req.params;
  const { barber_id } = req.query;
  const dayOfWeek = new Date(date).getDay();

  const hours = db.prepare('SELECT * FROM business_hours WHERE day_of_week = ? AND store_id = ? AND barber_id IS NULL').get(dayOfWeek, storeId);
  if (!hours || hours.is_closed) {
    return res.json({ available: false, slots: [], message: 'Closed on this day' });
  }

  const dateStart = `${date}T00:00:00`;
  const dateEnd = `${date}T23:59:59`;
  let aptQuery = `
    SELECT start_time, end_time FROM appointments
    WHERE store_id = ? AND status = 'confirmed' AND start_time >= ? AND start_time <= ?
  `;
  const aptParams = [storeId, dateStart, dateEnd];
  if (barber_id) { aptQuery += ' AND barber_id = ?'; aptParams.push(barber_id); }

  const booked = db.prepare(aptQuery).all(...aptParams);

  const slots = [];
  const [openH, openM] = hours.open_time.split(':').map(Number);
  const [closeH, closeM] = hours.close_time.split(':').map(Number);

  for (let h = openH; h < closeH || (h === closeH && 0 < closeM); h++) {
    for (let m = (h === openH ? openM : 0); m < 60; m += 30) {
      if (h === closeH && m >= closeM) break;
      const slotStart = `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
      const slotEnd = new Date(new Date(slotStart).getTime() + 30 * 60000).toISOString();
      const isBooked = booked.some(b => b.start_time < slotEnd && b.end_time > slotStart);
      slots.push({ time: slotStart, available: !isBooked });
    }
  }

  res.json({ available: true, slots, hours });
});

export default router;
