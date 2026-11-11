# Agent instructions

## Donation Log Cloudflare operations

- Deploy or manage only the Donation Log API Worker with Wrangler and the existing Windows user environment variable `CLOUDFLARE_API_TOKEN`. This is the working path used by the Parley project.
- The existing Cloudflare MCP connection has a separate OAuth grant that may lack Worker write scopes. Do not toggle, uninstall, reconnect, or edit that MCP connection for Donation Log deployment. Do not create or request a replacement API token unless the user explicitly asks.
- Never print the Cloudflare token, put it in source, include it in command-line arguments, or send it through chat. Read it from the existing user environment variable in the local shell.
- Use the already installed Wrangler binary at `C:\Projects\parley-pickem-live\node_modules\wrangler\bin\wrangler.js` when available. If shell network access is blocked, request network access for Wrangler rather than changing Cloudflare MCP settings.
- Deploy only `donation-log-api` with `backend/donation-log.wrangler.jsonc`. Its D1 database is `donation-log-db`. Do not change `daily-workout-auth`, `parley-pickem`, or other production Workers.
- Keep `DONATION_DATA_KEY` as a Cloudflare Worker secret and retain its backup in a persistent, access-restricted local directory outside the repository. Never commit the key, health records, exports, screenshots, or database dumps.
- Keep the former private Donation Log Site and database as rollback copies until the new hosting path and all migrated records are verified.
