import { Router } from 'express';
import db from '../db/index.js';
import { v4 as uuid } from 'uuid';

const router = Router();

router.get('/', (req, res) => {
  const barbers = db.prepare('SELECT * FROM barbers WHERE active = 1 ORDER BY name').all();
  res.json(barbers);
});

router.post('/', (req, res) => {
  const { name, google_calendar_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const id = `barber_${uuid().slice(0, 8)}`;
  db.prepare('INSERT INTO barbers (id, name, google_calendar_id) VALUES (?, ?, ?)')
    .run(id, name, google_calendar_id || null);
  res.status(201).json(db.prepare('SELECT * FROM barbers WHERE id = ?').get(id));
});

router.patch('/:id', (req, res) => {
  const { name, active, google_calendar_id } = req.body;
  const barber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(req.params.id);
  if (!barber) return res.status(404).json({ error: 'Barber not found' });

  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
  if (google_calendar_id !== undefined) { updates.push('google_calendar_id = ?'); params.push(google_calendar_id); }

  if (updates.length === 0) return res.json(barber);
  params.push(req.params.id);
  db.prepare(`UPDATE barbers SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json(db.prepare('SELECT * FROM barbers WHERE id = ?').get(req.params.id));
});

export default router;
