import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// Get store settings
router.get('/', (req, res) => {
  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.storeId);
  const hours = db.prepare('SELECT * FROM business_hours WHERE store_id = ? ORDER BY day_of_week').all(req.storeId);
  res.json({ ...store, hours });
});

// Update store settings
router.patch('/', (req, res) => {
  const { name, phone, address, timezone, greeting_message } = req.body;
  const updates = [];
  const params = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
  if (address !== undefined) { updates.push('address = ?'); params.push(address); }
  if (timezone !== undefined) { updates.push('timezone = ?'); params.push(timezone); }
  if (greeting_message !== undefined) { updates.push('greeting_message = ?'); params.push(greeting_message); }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.storeId);
    db.prepare(`UPDATE stores SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.storeId);
  res.json(store);
});

// Update business hours
router.put('/hours', (req, res) => {
  const { hours } = req.body;
  if (!Array.isArray(hours)) return res.status(400).json({ error: 'hours array is required' });

  const upsert = db.prepare(`
    UPDATE business_hours SET open_time = ?, close_time = ?, is_closed = ?
    WHERE day_of_week = ? AND store_id = ? AND barber_id IS NULL
  `);

  const transaction = db.transaction((items) => {
    for (const h of items) {
      upsert.run(h.open_time, h.close_time, h.is_closed ? 1 : 0, h.day_of_week, req.storeId);
    }
  });
  transaction(hours);

  const updated = db.prepare('SELECT * FROM business_hours WHERE store_id = ? ORDER BY day_of_week').all(req.storeId);
  res.json(updated);
});

// Dashboard stats
router.get('/stats', (req, res) => {
  const storeId = req.storeId;
  const today = new Date().toISOString().split('T')[0];
  const todayStart = `${today}T00:00:00`;
  const todayEnd = `${today}T23:59:59`;

  const stats = {
    todayAppointments: db.prepare(
      "SELECT COUNT(*) as count FROM appointments WHERE store_id = ? AND start_time >= ? AND start_time <= ? AND status = 'confirmed'"
    ).get(storeId, todayStart, todayEnd).count,
    totalAppointments: db.prepare(
      "SELECT COUNT(*) as count FROM appointments WHERE store_id = ? AND status = 'confirmed'"
    ).get(storeId).count,
    totalCalls: db.prepare('SELECT COUNT(*) as count FROM calls WHERE store_id = ?').get(storeId).count,
    totalCustomers: db.prepare('SELECT COUNT(*) as count FROM customers WHERE store_id = ?').get(storeId).count,
    recentCalls: db.prepare(
      'SELECT * FROM calls WHERE store_id = ? ORDER BY started_at DESC LIMIT 5'
    ).all(storeId),
    upcomingAppointments: db.prepare(`
      SELECT a.*, c.first_name as customer_name, c.phone as customer_phone,
             s.name as service_name, b.name as barber_name
      FROM appointments a
      LEFT JOIN customers c ON a.customer_id = c.id
      LEFT JOIN services s ON a.service_id = s.id
      LEFT JOIN barbers b ON a.barber_id = b.id
      WHERE a.store_id = ? AND a.start_time >= ? AND a.status = 'confirmed'
      ORDER BY a.start_time ASC LIMIT 10
    `).all(storeId, new Date().toISOString())
  };

  res.json(stats);
});

export default router;
