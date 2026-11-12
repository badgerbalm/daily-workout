# Donation Log deployment and storage

The standalone Donation Log website is published from `badgerbalm/donation-log` at `https://badgerbalm.github.io/donation-log/`. `/daily-workout/donation-log/` is only a redirect for old bookmarks. The data API is a separate Cloudflare Worker (`donation-log-api`) with its own D1 database (`donation-log-db`). It checks owner identity through the shared `daily-workout-auth` OAuth/session broker. Donation Log starts its own Google sign-in and the callback returns to Donation Log. The Workout app, Sheet sync, and Workout database are not used to store or load donation records.

Donation visit and medication JSON payloads are AES-GCM encrypted before they are written to D1. A Cloudflare secret named `DONATION_DATA_KEY` holds the encryption key. Deterministic record identifiers are HMAC-derived, so D1 does not need to store dates, names, measurements, notes, medication labels, Google credentials, or session tokens in searchable columns. Do not commit the encryption key, exports, screenshots, database dumps, or personal records to GitHub.

## Cloudflare deployment instructions for future Codex work

Use the existing Windows `CLOUDFLARE_API_TOKEN` user environment variable with the already installed Wrangler CLI. This is the same deployment route used for the Parley Worker. Do not use the Cloudflare MCP connection for Worker deployments: its OAuth grant can lack Worker write scopes even while dashboard tokens look correct. Do not uninstall, reconnect, toggle, or edit the working Cloudflare MCP connection. Do not create or request a replacement API token unless the user explicitly asks.

Never print, copy into chat, place in command-line arguments, or commit the API token. If shell network access is blocked, request network access for Wrangler; do not change Cloudflare MCP settings. Stop if the user-level token or Wrangler binary is unavailable.

From the Daily Workout repository root in PowerShell:

```powershell
$env:CLOUDFLARE_API_TOKEN = [Environment]::GetEnvironmentVariable('CLOUDFLARE_API_TOKEN', 'User')
$env:XDG_CONFIG_HOME = Join-Path $env:TEMP 'donation-log-wrangler'
$wrangler = 'C:\Projects\parley-pickem-live\node_modules\wrangler\bin\wrangler.js'
node $wrangler whoami
node $wrangler secret list --config wrangler.jsonc
node $wrangler secret list --config backend/donation-log.wrangler.jsonc
```

The secret-list command prints names only, not values. Confirm `whoami` reports the intended account and the existing secret names are present. The current deployment already has `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, and `DONATION_DATA_KEY`; preserve their values and do not rotate them.

The Donation API uses a Cloudflare Service Binding, not a network fetch, to call `daily-workout-auth`. Its config declares `AUTH_SERVICE` -> `daily-workout-auth`. Check that `https://daily-workout-auth.onlinesny.workers.dev/session` with Origin `https://badgerbalm.github.io` returns an authentication response (401 without a bearer token), not 404. A 404 means the deployed auth Worker is behind the repository source.

When updating the shared auth Worker source or repairing a missing `/session` route, deploy the reviewed source with the existing config:

```powershell
node $wrangler deploy --config wrangler.jsonc
```

This preserves the existing `AUTH_DB` binding and configured cron trigger; do not run D1 creation or migration commands. The auth Worker is used by Daily Workout sign-in, so update it only from the repository source and verify the existing secret names first.

Deploy the Donation Log API separately:

```powershell
node $wrangler deploy --config backend/donation-log.wrangler.jsonc
```

This deploys only `donation-log-api`, its existing `donation-log-db` binding, and the `AUTH_SERVICE` binding. Do not change `parley-pickem`, `parley-pickem-staging`, or other production Workers.

## Data protection

The existing `donation-log-db` database and its ID are declared in `backend/donation-log.wrangler.jsonc`; do not recreate it. The `DONATION_DATA_KEY` secret and a backup in a persistent access-restricted local directory outside the repository already exist. Do not rotate that key: doing so would make current encrypted rows unreadable. For a brand-new environment only, create the database, apply `backend/donation-log-schema.sql`, and create a new restricted key backup before storing health records.

Never store the health dataset, sanitized imports, or encryption key in the scripts folder, logs folder, GitHub, screenshots, or chat. Keep the local key file ACL restricted to the current user and SYSTEM.

## Publish the website

Publish the standalone frontend from the `badgerbalm/donation-log` repository to its own `/donation-log/` site. Do not copy the application into the Daily Workout project. Keep `/daily-workout/donation-log/` as a redirect for existing bookmarks.

## Authentication and privacy

Donation Log has its own Google sign-in button and session key. It starts OAuth from `https://badgerbalm.github.io/donation-log/`, and the shared auth Worker returns the completed session directly to that URL. Users should not need to open the Workout screen. The API accepts calls only from `https://badgerbalm.github.io`, verifies the bearer session against the auth Worker, and rejects any identity other than the configured owner. All API responses disable caching. Donation data stays in the separate encrypted `donation-log-db`, not Google Sheets.

The former private Donation Log Site and database remain untouched as rollback copies. Do not remove them unless the user explicitly asks.
