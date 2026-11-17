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
CREATE TABLE IF NOT EXISTS oura_oauth_pending (
 state_hash TEXT PRIMARY KEY, code_verifier TEXT NOT NULL, expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS oura_connection (
 owner TEXT PRIMARY KEY, access_cipher TEXT NOT NULL, access_expires INTEGER NOT NULL,
 refresh_cipher TEXT NOT NULL, scopes TEXT NOT NULL, updated_at INTEGER NOT NULL,
 refresh_lock_until INTEGER NOT NULL DEFAULT 0, last_sync_at INTEGER
);
CREATE TABLE IF NOT EXISTS oura_daily_scores (
 day TEXT PRIMARY KEY, record_cipher TEXT NOT NULL, updated_at INTEGER NOT NULL,
 sheet_synced_at INTEGER
);
CREATE TABLE IF NOT EXISTS oura_score_documents (
 data_type TEXT NOT NULL, object_id TEXT NOT NULL, day TEXT NOT NULL,
 PRIMARY KEY(data_type, object_id)
);
CREATE TABLE IF NOT EXISTS oura_pending_events (
 event_hash TEXT PRIMARY KEY, payload_cipher TEXT NOT NULL, created_at INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS oura_webhooks (
 id TEXT PRIMARY KEY, event_type TEXT NOT NULL, data_type TEXT NOT NULL,
 callback_url TEXT NOT NULL, verification_hash TEXT NOT NULL UNIQUE,
 expires_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
 endpoint_hash TEXT PRIMARY KEY, owner TEXT NOT NULL, subscription_cipher TEXT NOT NULL,
 reporter_hash TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS push_subscriptions_by_owner ON push_subscriptions(owner);
CREATE INDEX IF NOT EXISTS push_subscriptions_by_reporter ON push_subscriptions(reporter_hash);
CREATE TABLE IF NOT EXISTS push_problem_notices (
 owner TEXT NOT NULL, code TEXT NOT NULL, last_sent INTEGER NOT NULL,
 PRIMARY KEY(owner, code)
);
