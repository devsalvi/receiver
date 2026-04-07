-- Business settings
CREATE TABLE IF NOT EXISTS business (
  id INTEGER PRIMARY KEY DEFAULT 1,
  name TEXT NOT NULL DEFAULT 'My Barber Shop',
  phone TEXT,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  greeting_message TEXT DEFAULT 'Hi, this is {shop_name}. I''m an AI assistant — I can book your appointment.',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Barbers / staff
CREATE TABLE IF NOT EXISTS barbers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  google_calendar_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Services offered
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  price_cents INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Business hours
CREATE TABLE IF NOT EXISTS business_hours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_of_week INTEGER NOT NULL, -- 0=Sunday, 6=Saturday
  open_time TEXT NOT NULL,      -- HH:MM format
  close_time TEXT NOT NULL,     -- HH:MM format
  is_closed INTEGER NOT NULL DEFAULT 0,
  barber_id TEXT,               -- NULL means applies to all
  FOREIGN KEY (barber_id) REFERENCES barbers(id)
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  barber_id TEXT,
  service_id TEXT,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed, cancelled, completed, no_show
  google_event_id TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (barber_id) REFERENCES barbers(id),
  FOREIGN KEY (service_id) REFERENCES services(id)
);

-- Call logs
CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  vapi_call_id TEXT UNIQUE,
  customer_phone TEXT,
  customer_id TEXT,
  appointment_id TEXT,
  direction TEXT NOT NULL DEFAULT 'inbound',
  status TEXT NOT NULL DEFAULT 'in_progress', -- in_progress, completed, failed, missed
  duration_seconds INTEGER,
  transcript TEXT,
  recording_url TEXT,
  summary TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

-- SMS logs
CREATE TABLE IF NOT EXISTS sms_logs (
  id TEXT PRIMARY KEY,
  appointment_id TEXT,
  customer_phone TEXT NOT NULL,
  message_type TEXT NOT NULL, -- confirmation, reminder_24h, reminder_2h, custom
  message_body TEXT NOT NULL,
  twilio_sid TEXT,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, sent, delivered, failed
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

-- Reminders queue
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id TEXT NOT NULL,
  reminder_type TEXT NOT NULL, -- reminder_24h, reminder_2h
  scheduled_for DATETIME NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

-- Seed default business
INSERT OR IGNORE INTO business (id, name) VALUES (1, 'My Barber Shop');

-- Seed default business hours (Mon-Sat 9-7, Sun closed)
INSERT OR IGNORE INTO business_hours (day_of_week, open_time, close_time, is_closed) VALUES
  (0, '09:00', '17:00', 1),  -- Sunday closed
  (1, '09:00', '19:00', 0),  -- Monday
  (2, '09:00', '19:00', 0),  -- Tuesday
  (3, '09:00', '19:00', 0),  -- Wednesday
  (4, '09:00', '19:00', 0),  -- Thursday
  (5, '09:00', '19:00', 0),  -- Friday
  (6, '09:00', '17:00', 0);  -- Saturday

-- Seed default services
INSERT OR IGNORE INTO services (id, name, duration_minutes, price_cents) VALUES
  ('svc_haircut', 'Haircut', 30, 3000),
  ('svc_beard', 'Beard Trim', 15, 1500),
  ('svc_combo', 'Haircut + Beard', 45, 4000),
  ('svc_shave', 'Hot Shave', 30, 2500);

-- Seed default barber
INSERT OR IGNORE INTO barbers (id, name) VALUES ('barber_default', 'Any Available');
