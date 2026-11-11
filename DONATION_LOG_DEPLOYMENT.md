# Donation Log on Daily Workout hosting

The Donation Log static files live at `/daily-workout/donation-log/` on the existing GitHub Pages origin. Its data API is a separate Cloudflare Worker (`donation-log-api`) with a separate D1 database (`donation-log-db`). The API validates the existing owner-only Daily Workout session before every data request. The donation data database and Workout data database remain separate.

Donation visit and medication JSON payloads are AES-GCM encrypted before they are written to D1. A Cloudflare secret named `DONATION_DATA_KEY` holds the 32-byte base64url encryption key. Deterministic record identifiers are HMAC-derived, so D1 does not need to store dates, names, measurements, notes, medication labels, Google credentials, or session tokens in searchable columns. Do not commit the encryption key, exports, screenshots, database dumps, or personal records to GitHub.

## Cloudflare deployment instructions for future Codex work

Use the existing Windows `CLOUDFLARE_API_TOKEN` user environment variable with the already-installed Wrangler CLI. This is the same deployment route used for the Parley Worker. Do not use the Cloudflare MCP connection for Worker deployments: its OAuth grant can lack Worker write scopes even while dashboard tokens look correct. Do not uninstall, reconnect, toggle, or edit the working Cloudflare MCP connection for this project. Do not create or request a replacement API token unless the user explicitly asks.

Never print, copy into chat, place in command-line arguments, or commit the API token. If the shell cannot reach Cloudflare, request network access for that shell and retry Wrangler; do not switch to changing MCP or dashboard connection settings. If the user-level token or Wrangler binary is unavailable, stop and explain the specific missing prerequisite rather than creating credentials.

From the Daily Workout repository root in PowerShell:

```powershell
$env:CLOUDFLARE_API_TOKEN = [Environment]::GetEnvironmentVariable('CLOUDFLARE_API_TOKEN', 'User')
$env:XDG_CONFIG_HOME = Join-Path $env:TEMP 'donation-log-wrangler'
$wrangler = 'C:\Projects\parley-pickem-live\node_modules\wrangler\bin\wrangler.js'
node $wrangler whoami
node $wrangler deploy --config backend/donation-log.wrangler.jsonc
```

The `XDG_CONFIG_HOME` override keeps Wrangler logs in the temporary directory when the normal profile log path is inaccessible. Confirm `whoami` reports the intended Cloudflare account. Deploy only the uniquely named `donation-log-api` Worker; do not alter `daily-workout-auth`, `parley-pickem`, or other Workers.

The `donation-log-db` D1 database already exists in this account and its ID is declared in `backend/donation-log.wrangler.jsonc`; do not recreate it. For a new environment only, create the database once and apply `backend/donation-log-schema.sql` before deployment.

## Encryption secret and backup

Before storing any health records, generate a fresh 32-byte random key encoded as unpadded base64url. Save a local backup in a persistent access-restricted directory outside the Git repository, with Windows permissions limited to the current user and SYSTEM. Then set the same value as the Cloudflare Worker secret with:

```powershell
node $wrangler secret put DONATION_DATA_KEY --config backend/donation-log.wrangler.jsonc
```

Do not print the key or use temporary folders for its permanent backup. Losing the key makes encrypted rows unreadable. Keep the local backup protected and do not place it in GitHub, screenshots, logs, or chat.

## Publish the website

Publish the repository's `main` branch to GitHub Pages using the current Daily Workout Pages configuration. The app is self-contained under `donation-log/` and uses relative asset links, so its files do not interfere with the Workout app's root routes. The Donation Log link on the Workout home page points to this subpath.

## Authentication and privacy

The browser reuses the same-origin owner session created by Daily Workout. If its session expires, open Daily Workout, reconnect Google, return to the Donation Log, and refresh. The API accepts calls only from `https://badgerbalm.github.io`, verifies the bearer session against the existing auth Worker, and rejects any identity other than the configured owner. All API responses disable caching. The app does not send donation data to Google Sheets.

The former ChatGPT Site and its database are the rollback copy until the record count, medication timeline, exports, and charts are confirmed on the new site. Do not remove the old site or database during cutover.
