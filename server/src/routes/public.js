import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// Public store page data — anyone can view
router.get('/store/:slug', (req, res) => {
  const store = db.prepare(`
    SELECT id, slug, name, phone, address, timezone FROM stores WHERE slug = ?
  `).get(req.params.slug);

  if (!store) return res.status(404).json({ error: 'Store not found' });

  const services = db.prepare(
    'SELECT id, name, duration_minutes, price_cents FROM services WHERE store_id = ? AND active = 1 ORDER BY name'
  ).all(store.id);

  const barbers = db.prepare(
    'SELECT id, name FROM barbers WHERE store_id = ? AND active = 1 ORDER BY name'
  ).all(store.id);

  const hours = db.prepare(
    'SELECT day_of_week, open_time, close_time, is_closed FROM business_hours WHERE store_id = ? AND barber_id IS NULL ORDER BY day_of_week'
  ).all(store.id);

  res.json({ ...store, services, barbers, hours });
});

// Public availability check
router.get('/store/:slug/availability/:date', (req, res) => {
  const store = db.prepare('SELECT id FROM stores WHERE slug = ?').get(req.params.slug);
  if (!store) return res.status(404).json({ error: 'Store not found' });

  const { date } = req.params;
  const { barber_id } = req.query;
  const dayOfWeek = new Date(date).getDay();

  const hours = db.prepare(
    'SELECT * FROM business_hours WHERE day_of_week = ? AND store_id = ? AND barber_id IS NULL'
  ).get(dayOfWeek, store.id);

  if (!hours || hours.is_closed) {
    return res.json({ available: false, slots: [], message: 'Closed on this day' });
  }

  const dateStart = `${date}T00:00:00`;
  const dateEnd = `${date}T23:59:59`;
  let aptQuery = `
    SELECT start_time, end_time FROM appointments
    WHERE store_id = ? AND status = 'confirmed' AND start_time >= ? AND start_time <= ?
  `;
  const aptParams = [store.id, dateStart, dateEnd];
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
