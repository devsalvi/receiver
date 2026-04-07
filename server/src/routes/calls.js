import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// List calls
router.get('/', (req, res) => {
  const { limit = 50, offset = 0, status } = req.query;
  let query = `
    SELECT cl.*, c.first_name as customer_name
    FROM calls cl
    LEFT JOIN customers c ON cl.customer_id = c.id
    WHERE 1=1
  `;
  const params = [];
  if (status) { query += ' AND cl.status = ?'; params.push(status); }
  query += ' ORDER BY cl.started_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const calls = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM calls').get().count;
  res.json({ calls, total });
});

// Get single call with transcript
router.get('/:id', (req, res) => {
  const call = db.prepare(`
    SELECT cl.*, c.first_name as customer_name, c.phone as customer_phone
    FROM calls cl
    LEFT JOIN customers c ON cl.customer_id = c.id
    WHERE cl.id = ?
  `).get(req.params.id);

  if (!call) return res.status(404).json({ error: 'Call not found' });
  res.json(call);
});

export default router;
