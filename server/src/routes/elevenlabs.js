import { Router } from 'express';
import db from '../db/index.js';
import { v4 as uuid } from 'uuid';
import { sendConfirmationSMS } from '../services/sms.js';
import { createGoogleCalendarEvent } from '../services/calendar.js';
import { scheduleReminders } from '../services/reminders.js';

const router = Router();

// Tool webhook: check availability
router.post('/check-availability', (req, res) => {
  const { store_id, date, barber_name } = req.body;

  if (!store_id || !date) {
    return res.json({ available_slots: 'Missing store_id or date' });
  }

  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(store_id);
  if (!store) return res.json({ available_slots: 'Store not found' });

  const dayOfWeek = new Date(date).getDay();
  const hours = db.prepare('SELECT * FROM business_hours WHERE day_of_week = ? AND store_id = ? AND barber_id IS NULL').get(dayOfWeek, store_id);

  if (!hours || hours.is_closed) {
    return res.json({ available_slots: `Sorry, ${store.name} is closed on that day. We're open Monday through Saturday.` });
  }

  // Find barber ID if specified
  let barberId = null;
  if (barber_name && barber_name.toLowerCase() !== 'any') {
    const barber = db.prepare('SELECT * FROM barbers WHERE LOWER(name) LIKE ? AND store_id = ? AND active = 1')
      .get(`%${barber_name.toLowerCase()}%`, store_id);
    if (barber) barberId = barber.id;
  }

  // Get booked slots
  const dateStart = `${date}T00:00:00`;
  const dateEnd = `${date}T23:59:59`;
  let aptQuery = "SELECT start_time, end_time FROM appointments WHERE store_id = ? AND status = 'confirmed' AND start_time >= ? AND start_time <= ?";
  const aptParams = [store_id, dateStart, dateEnd];
  if (barberId) { aptQuery += ' AND barber_id = ?'; aptParams.push(barberId); }

  const booked = db.prepare(aptQuery).all(...aptParams);

  // Generate available slots
  const [openH, openM] = hours.open_time.split(':').map(Number);
  const [closeH, closeM] = hours.close_time.split(':').map(Number);
  const available = [];

  for (let h = openH; h < closeH || (h === closeH && 0 < closeM); h++) {
    for (let m = (h === openH ? openM : 0); m < 60; m += 30) {
      if (h === closeH && m >= closeM) break;
      const slotStart = `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
      const slotEnd = new Date(new Date(slotStart).getTime() + 30 * 60000).toISOString();
      const isBooked = booked.some(b => b.start_time < slotEnd && b.end_time > slotStart);
      if (!isBooked) {
        const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
        const ampm = h >= 12 ? 'PM' : 'AM';
        available.push(`${hour12}:${String(m).padStart(2, '0')} ${ampm}`);
      }
    }
  }

  if (available.length === 0) {
    return res.json({ available_slots: `Sorry, there are no available slots on ${date}. Would you like to try a different day?` });
  }

  const slotsToShow = available.length > 6
    ? `We have ${available.length} slots available. Some options: ${available.slice(0, 3).join(', ')}, or later at ${available.slice(-3).join(', ')}.`
    : `Available times: ${available.join(', ')}.`;

  return res.json({ available_slots: slotsToShow });
});

// Tool webhook: book appointment
router.post('/book-appointment', async (req, res) => {
  const { store_id, customer_name, customer_phone, service_name, barber_name, date, time } = req.body;

  if (!store_id || !customer_name || !date || !time) {
    return res.json({ result: 'Missing required booking details' });
  }

  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(store_id);
  if (!store) return res.json({ result: 'Store not found' });

  // Find service
  const service = db.prepare('SELECT * FROM services WHERE LOWER(name) LIKE ? AND store_id = ? AND active = 1')
    .get(`%${(service_name || '').toLowerCase()}%`, store_id);

  // Find barber
  let barber = null;
  if (barber_name && barber_name.toLowerCase() !== 'any') {
    barber = db.prepare('SELECT * FROM barbers WHERE LOWER(name) LIKE ? AND store_id = ? AND active = 1')
      .get(`%${barber_name.toLowerCase()}%`, store_id);
  }
  const defaultBarber = db.prepare("SELECT id FROM barbers WHERE store_id = ? AND name = 'Any Available'").get(store_id);
  const barberId = barber ? barber.id : (defaultBarber?.id || 'barber_default');

  // Build start/end time
  const startTime = `${date}T${time}:00`;
  const durationMinutes = service ? service.duration_minutes : 30;
  const endTime = new Date(new Date(startTime).getTime() + durationMinutes * 60000).toISOString();

  // Check conflict
  const conflict = db.prepare(`
    SELECT id FROM appointments
    WHERE store_id = ? AND barber_id = ? AND status = 'confirmed'
    AND start_time < ? AND end_time > ?
  `).get(store_id, barberId, endTime, startTime);

  if (conflict) {
    return res.json({ result: "I'm sorry, that slot was just taken. Would you like to pick another time?" });
  }

  // Format phone
  const cleanPhone = (customer_phone || '').replace(/\D/g, '');
  const formattedPhone = cleanPhone ? (cleanPhone.startsWith('1') ? `+${cleanPhone}` : `+1${cleanPhone}`) : '';

  // Find or create customer
  let customer;
  if (formattedPhone) {
    customer = db.prepare('SELECT * FROM customers WHERE phone = ? AND store_id = ?').get(formattedPhone, store_id);
  }
  if (!customer) {
    const customerId = uuid();
    db.prepare('INSERT INTO customers (id, store_id, first_name, phone) VALUES (?, ?, ?, ?)')
      .run(customerId, store_id, customer_name, formattedPhone || 'unknown');
    customer = { id: customerId, first_name: customer_name, phone: formattedPhone };
  }

  // Create appointment
  const appointmentId = uuid();
  db.prepare(`
    INSERT INTO appointments (id, store_id, customer_id, barber_id, service_id, start_time, end_time)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(appointmentId, store_id, customer.id, barberId, service?.id, startTime, endTime);

  // Google Calendar sync
  try {
    const eventId = await createGoogleCalendarEvent({
      summary: `${customer_name} - ${service ? service.name : 'Appointment'}`,
      start: startTime,
      end: endTime,
      description: `Customer: ${customer_name}\nPhone: ${formattedPhone}`,
    });
    if (eventId) {
      db.prepare('UPDATE appointments SET google_event_id = ? WHERE id = ?').run(eventId, appointmentId);
    }
  } catch (err) {
    console.error('Calendar sync failed:', err.message);
  }

  // SMS confirmation
  if (formattedPhone) {
    try {
      await sendConfirmationSMS(formattedPhone, {
        customerName: customer_name,
        serviceName: service ? service.name : 'Appointment',
        startTime,
        businessName: store.name,
      }, store_id);
    } catch (err) {
      console.error('SMS failed:', err.message);
    }
  }

  // Schedule reminders
  scheduleReminders(appointmentId, startTime);

  const hour = parseInt(time.split(':')[0]);
  const minute = time.split(':')[1];
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const ampm = hour >= 12 ? 'PM' : 'AM';

  return res.json({
    result: `Your appointment has been booked! ${customer_name}, you're all set for ${service ? service.name : 'your appointment'} on ${date} at ${hour12}:${minute} ${ampm}. You'll receive a text confirmation shortly.`,
  });
});

// Post-call webhook: receives transcript after call ends
router.post('/post-call', (req, res) => {
  const { type, data } = req.body;

  if (type === 'post_call_transcription' && data) {
    const callId = uuid();
    const transcript = (data.transcript || [])
      .map(t => `${t.role === 'agent' ? 'AI' : 'Caller'}: ${t.message}`)
      .join('\n');

    // Try to find the store from the agent name or conversation data
    const agentId = data.agent_id;
    const store = agentId
      ? db.prepare('SELECT id FROM stores WHERE elevenlabs_agent_id = ?').get(agentId)
      : null;

    db.prepare(`
      INSERT INTO calls (id, store_id, customer_phone, status, duration_seconds, transcript, summary, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      callId,
      store?.id || 'unknown',
      data.metadata?.caller_phone || null,
      'completed',
      data.metadata?.duration || null,
      transcript,
      data.analysis?.transcript_summary || null,
      data.metadata?.start_time || new Date().toISOString(),
      new Date().toISOString()
    );
  }

  res.json({ ok: true });
});

export default router;
