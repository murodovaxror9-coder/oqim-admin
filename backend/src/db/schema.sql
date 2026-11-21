CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'waiter', 'cashier', 'cook')),
  pin_hash TEXT NOT NULL,
  post TEXT,
  shift_start TEXT,
  blocked INTEGER NOT NULL DEFAULT 0,
  shift_started_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS zones (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tables (
  id INTEGER PRIMARY KEY,
  number INTEGER NOT NULL,
  zone_id INTEGER NOT NULL REFERENCES zones(id),
  seats INTEGER NOT NULL,
  shape TEXT NOT NULL DEFAULT 'rect' CHECK (shape IN ('rect', 'round')),
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  w INTEGER NOT NULL,
  h INTEGER NOT NULL,
  waiter_id INTEGER REFERENCES users(id),
  qr_token TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS tables_number_active ON tables(number) WHERE active = 1;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  name_uz TEXT NOT NULL,
  name_ru TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name_uz TEXT NOT NULL,
  name_ru TEXT NOT NULL,
  price INTEGER NOT NULL,
  prep_minutes INTEGER NOT NULL,
  station TEXT NOT NULL,
  wave INTEGER NOT NULL DEFAULT 2,
  unit TEXT NOT NULL DEFAULT 'portion',
  batch_size INTEGER,
  batch_warn INTEGER,
  batch_cook_minutes INTEGER,
  ikpu TEXT,
  available INTEGER NOT NULL DEFAULT 1,
  stop_reason TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  table_id INTEGER REFERENCES tables(id),
  waiter_id INTEGER REFERENCES users(id),
  guests INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'staff',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'cancelled')),
  opened_at INTEGER NOT NULL,
  ordered_at INTEGER,
  served_at INTEGER,
  bill_at INTEGER,
  paid_at INTEGER,
  promise_at INTEGER,
  promise_broken INTEGER NOT NULL DEFAULT 0,
  subtotal INTEGER NOT NULL DEFAULT 0,
  service_charge INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT,
  eat_minutes INTEGER,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS orders_paid ON orders(status, paid_at);
CREATE INDEX IF NOT EXISTS orders_table ON orders(table_id, status);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
  qty INTEGER NOT NULL,
  price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'cooking', 'ready', 'served', 'cancelled')),
  start_at INTEGER,
  ready_at INTEGER,
  cancel_requested_at INTEGER,
  cancel_reason TEXT
);
CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  table_id INTEGER NOT NULL REFERENCES tables(id),
  waiter_id INTEGER REFERENCES users(id),
  helped_from INTEGER REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('take', 'deliver', 'call', 'bill', 'clean')),
  sla_seconds INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  done_at INTEGER,
  admin_alert_at INTEGER,
  owner_alert_at INTEGER,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS tasks_open ON tasks(done_at);
CREATE INDEX IF NOT EXISTS tasks_created ON tasks(created_at);

CREATE TABLE IF NOT EXISTS exceptions (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  table_id INTEGER REFERENCES tables(id),
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id INTEGER REFERENCES order_items(id) ON DELETE SET NULL,
  menu_item_id INTEGER REFERENCES menu_items(id),
  booking_id INTEGER,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by INTEGER REFERENCES users(id),
  resolution TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS exceptions_status ON exceptions(status, created_at);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  table_id INTEGER NOT NULL REFERENCES tables(id),
  guest_name TEXT NOT NULL,
  phone TEXT,
  guests INTEGER NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'seated', 'cancelled', 'no_show')),
  created_at INTEGER NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS bookings_time ON bookings(starts_at);

CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY,
  guest_name TEXT NOT NULL,
  phone TEXT,
  guests INTEGER NOT NULL,
  quoted_minutes INTEGER NOT NULL,
  table_id INTEGER REFERENCES tables(id),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'seated', 'left')),
  created_at INTEGER NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
  size INTEGER NOT NULL,
  remaining INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ready_at INTEGER NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS batch_plans (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
  start_time TEXT NOT NULL,
  batches INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed')),
  confirmed_at INTEGER,
  confirmed_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,
  actor_id INTEGER REFERENCES users(id),
  actor_kind TEXT NOT NULL DEFAULT 'user' CHECK (actor_kind IN ('user', 'system', 'guest')),
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '{}',
  params TEXT NOT NULL DEFAULT '{}',
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS audit_at ON audit_log(at);

-- Jurnal faqat yoziladi: haqiqiy yozuvni o'zgartirib ham, o'chirib ham bo'lmaydi
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log faqat yoziladi');
END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_log WHEN OLD.is_demo = 0
BEGIN
  SELECT RAISE(ABORT, 'audit_log faqat yoziladi');
END;
