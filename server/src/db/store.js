import db from './index.js';
import { v4 as uuid } from 'uuid';

// Generate a URL-safe slug from a store name
export function generateSlug(name) {
  let slug = name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Ensure uniqueness
  const existing = db.prepare('SELECT id FROM stores WHERE slug = ?').get(slug);
  if (existing) {
    slug = `${slug}-${uuid().slice(0, 4)}`;
  }

  return slug;
}

// Provision a new store with default data when a user first signs up
export function provisionStore(storeId, storeName, ownerEmail) {
  const existing = db.prepare('SELECT id FROM stores WHERE id = ?').get(storeId);
  if (existing) return existing.id;

  const slug = generateSlug(storeName);

  const txn = db.transaction(() => {
    db.prepare(`
      INSERT INTO stores (id, slug, name, owner_email) VALUES (?, ?, ?, ?)
    `).run(storeId, slug, storeName, ownerEmail);

    // Default barber
    db.prepare('INSERT INTO barbers (id, store_id, name) VALUES (?, ?, ?)')
      .run(`barber_default_${storeId}`, storeId, 'Any Available');

    // Default services
    const services = [
      ['Haircut', 30, 3000],
      ['Beard Trim', 15, 1500],
      ['Haircut + Beard', 45, 4000],
      ['Hot Shave', 30, 2500],
    ];
    for (const [name, dur, price] of services) {
      db.prepare('INSERT INTO services (id, store_id, name, duration_minutes, price_cents) VALUES (?, ?, ?, ?, ?)')
        .run(`svc_${uuid().slice(0, 8)}`, storeId, name, dur, price);
    }

    // Default business hours (Mon-Sat 9-7, Sun closed)
    const hours = [
      [0, '09:00', '17:00', 1],
      [1, '09:00', '19:00', 0],
      [2, '09:00', '19:00', 0],
      [3, '09:00', '19:00', 0],
      [4, '09:00', '19:00', 0],
      [5, '09:00', '19:00', 0],
      [6, '09:00', '17:00', 0],
    ];
    for (const [day, open, close, closed] of hours) {
      db.prepare('INSERT INTO business_hours (store_id, day_of_week, open_time, close_time, is_closed) VALUES (?, ?, ?, ?, ?)')
        .run(storeId, day, open, close, closed);
    }
  });

  txn();
  return storeId;
}
