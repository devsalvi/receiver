-- Stores (tenants)
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'My Barber Shop',
  owner_email TEXT NOT NULL,
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
  store_id TEXT NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  google_calendar_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Services offered
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  price_cents INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Business hours
CREATE TABLE IF NOT EXISTS business_hours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL, -- 0=Sunday, 6=Saturday
  open_time TEXT NOT NULL,      -- HH:MM format
  close_time TEXT NOT NULL,     -- HH:MM format
  is_closed INTEGER NOT NULL DEFAULT 0,
  barber_id TEXT,               -- NULL means applies to all
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (barber_id) REFERENCES barbers(id)
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, phone),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
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
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (barber_id) REFERENCES barbers(id),
  FOREIGN KEY (service_id) REFERENCES services(id)
);

-- Call logs
CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
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
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

-- SMS logs
CREATE TABLE IF NOT EXISTS sms_logs (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  appointment_id TEXT,
  customer_phone TEXT NOT NULL,
  message_type TEXT NOT NULL, -- confirmation, reminder_24h, reminder_2h, custom
  message_body TEXT NOT NULL,
  twilio_sid TEXT,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, sent, delivered, failed
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id),
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

CREATE INDEX IF NOT EXISTS idx_barbers_store ON barbers(store_id);
CREATE INDEX IF NOT EXISTS idx_services_store ON services(store_id);
CREATE INDEX IF NOT EXISTS idx_business_hours_store ON business_hours(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_store ON customers(store_id);
CREATE INDEX IF NOT EXISTS idx_appointments_store ON appointments(store_id);
CREATE INDEX IF NOT EXISTS idx_calls_store ON calls(store_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_store ON sms_logs(store_id);
