import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function initDatabase(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  return db;
}

// Run standalone
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = initDatabase(join(__dirname, '../../data/receiver.db'));
  console.log('Database initialized successfully');
  db.close();
}
