CREATE TABLE IF NOT EXISTS donation_visits (
  visit_key TEXT PRIMARY KEY NOT NULL,
  payload_cipher TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS donation_medications (
  event_key TEXT PRIMARY KEY NOT NULL,
  payload_cipher TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

