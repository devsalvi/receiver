import { Router } from 'express';
import db from '../db/index.js';
import { v4 as uuid } from 'uuid';

const router = Router();

router.get('/', (req, res) => {
  const services = db.prepare('SELECT * FROM services WHERE active = 1 AND store_id = ? ORDER BY name').all(req.storeId);
  res.json(services);
});

router.post('/', (req, res) => {
  const { name, duration_minutes, price_cents } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const id = `svc_${uuid().slice(0, 8)}`;
  db.prepare('INSERT INTO services (id, store_id, name, duration_minutes, price_cents) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.storeId, name, duration_minutes || 30, price_cents || 0);
  res.status(201).json(db.prepare('SELECT * FROM services WHERE id = ?').get(id));
});

router.patch('/:id', (req, res) => {
  const { name, duration_minutes, price_cents, active } = req.body;
  const service = db.prepare('SELECT * FROM services WHERE id = ? AND store_id = ?').get(req.params.id, req.storeId);
  if (!service) return res.status(404).json({ error: 'Service not found' });

  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (duration_minutes !== undefined) { updates.push('duration_minutes = ?'); params.push(duration_minutes); }
  if (price_cents !== undefined) { updates.push('price_cents = ?'); params.push(price_cents); }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }

  if (updates.length === 0) return res.json(service);
  params.push(req.params.id);
  db.prepare(`UPDATE services SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json(db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('UPDATE services SET active = 0 WHERE id = ? AND store_id = ?').run(req.params.id, req.storeId);
  res.json({ success: true });
});

export default router;
