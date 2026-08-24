-- Solicitudes públicas de acceso; no crean usuarios ni conceden acceso automático.
CREATE TABLE IF NOT EXISTS registration_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT,
  business_name TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'approved', 'rejected')),
  notified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_registration_requests_status_created
  ON registration_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_registration_requests_whatsapp
  ON registration_requests(whatsapp);
