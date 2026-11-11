# Donation Log on Daily Workout hosting

The Donation Log static files live at `/daily-workout/donation-log/` on the existing GitHub Pages origin. Its data API is a separate Cloudflare Worker (`donation-log-api`) with a separate D1 database (`donation-log-db`). The API validates the existing owner-only Daily Workout session before every data request. The donation data database and Workout data database remain separate.

Donation visit and medication JSON payloads are AES-GCM encrypted before they are written to D1. A Cloudflare secret named `DONATION_DATA_KEY` holds the 32-byte base64url encryption key. Deterministic record identifiers are HMAC-derived, so D1 does not need to store dates, names, measurements, notes, medication labels, Google credentials, or session tokens in searchable columns. Do not commit the encryption key, exports, screenshots, database dumps, or personal records to GitHub.

## Deploy the API

From the repository root, create the D1 database from `backend/donation-log-schema.sql`, apply the binding in `backend/donation-log.wrangler.jsonc`, and set `DONATION_DATA_KEY` with `wrangler secret put DONATION_DATA_KEY --config backend/donation-log.wrangler.jsonc`. Generate a fresh 32-byte random key encoded as unpadded base64url before the first deployment. Retain a protected offline backup of that key: losing it makes encrypted rows unreadable. Then deploy with:

```sh
npx wrangler deploy --config backend/donation-log.wrangler.jsonc
```

## Publish the website

Publish the repository's `main` branch to GitHub Pages using the current Daily Workout Pages configuration. The app is self-contained under `donation-log/` and uses relative asset links, so its files do not interfere with the Workout app's root routes. The Donation Log link on the Workout home page points to this subpath.

## Authentication and privacy

The browser reuses the same-origin owner session created by Daily Workout. If its session expires, open Daily Workout, reconnect Google, return to the Donation Log, and refresh. The API accepts calls only from `https://badgerbalm.github.io`, verifies the bearer session against the existing auth Worker, and rejects any identity other than the configured owner. All API responses disable caching. The app does not send donation data to Google Sheets.

The former ChatGPT Site and its database are the rollback copy until the record count, medication timeline, exports, and charts are confirmed on the new site. Do not remove the old site or database during cutover.

