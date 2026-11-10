CREATE TABLE IF NOT EXISTS oauth_pending (
 state_hash TEXT PRIMARY KEY, challenge TEXT NOT NULL, client_state TEXT NOT NULL,
 google_verifier TEXT NOT NULL, expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_tickets (
 ticket_hash TEXT PRIMARY KEY, challenge TEXT NOT NULL, refresh_cipher TEXT NOT NULL,
 grant_expires INTEGER, expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS app_sessions (
 token_hash TEXT PRIMARY KEY, refresh_cipher TEXT NOT NULL,
 access_cipher TEXT, access_expires INTEGER NOT NULL DEFAULT 0,
 expires INTEGER NOT NULL, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS shared_workout_state (
 owner TEXT PRIMARY KEY, state_cipher TEXT NOT NULL, updated_at TEXT NOT NULL, revision INTEGER NOT NULL
);
