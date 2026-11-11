# Agent instructions

## Daily Workout Safari Shortcut handoff

- Keep Start and Done Shortcut launches directly inside the user's tap handler. Do not `await` `cardViewSaveTask`, IndexedDB, or another async save before `openWorkoutShortcut(...)`; Safari may lose the user gesture and show an app-opening prompt or fail the Shortcut URL.
- `openWorkoutShortcut(...)` checkpoints workout state synchronously, launches the Shortcut, then flushes the database asynchronously. Preserve that ordering so state is saved without delaying the handoff.
- Production (`data-shortcuts="safari"`) must always resolve to the Safari-specific Shortcut names, regardless of any stale `localStorage` profile or lock. Match the exact names in `safari-setup.html`.
- If a Shortcut is reported invalid, compare the generated name for that route against the device Shortcut's exact name before changing the URL scheme or routing. Butterfly stretch uses the generic `Workout Timer Watch Safari`; walking/strength/core and Done use separate names.
- Preserve these cases in `tests/verify-safari-shortcuts.cjs`; it checks that Start and Done handoffs happen synchronously and that production routes use Safari names.

## Donation Log Cloudflare operations

- Use the existing Windows `CLOUDFLARE_API_TOKEN` user environment variable with the already installed Wrangler CLI. This is the deployment route used by the Parley project.
- The Cloudflare MCP connection has a separate OAuth grant and may lack Worker write scopes. Do not toggle, uninstall, reconnect, or edit it for this project. Do not create or request a replacement API token unless the user asks.
- Never print the Cloudflare token, put it in source, include it in command-line arguments, or send it through chat. Read it from the existing user environment variable in the local shell.
- Use `C:\\Projects\\parley-pickem-live\\node_modules\\wrangler\\bin\\wrangler.js` when available. If shell network access is blocked, request network access for Wrangler instead of changing Cloudflare MCP settings.
- Deploy `donation-log-api` from `backend/donation-log.wrangler.jsonc`; it uses the separate `donation-log-db` database and the `AUTH_SERVICE` binding to `daily-workout-auth`.
- The Donation Log requires the existing `daily-workout-auth` `/session` endpoint. It returned HTTP 404 before the current auth source was deployed. If that endpoint returns 404 again, inspect `backend/worker.mjs` and `wrangler.jsonc`; deploy only `daily-workout-auth` from that config after confirming the existing D1 binding and required secret names. This Worker is shared with Daily Workout sign-in, so make only reviewed, source-backed changes.
- Do not change `parley-pickem`, `parley-pickem-staging`, or other Workers.
- Preserve the existing `AUTH_DB`, `donation-log-db`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, and `DONATION_DATA_KEY`. Never recreate databases or rotate encryption keys during routine deployments.
- Keep the `DONATION_DATA_KEY` backup and all personal health data in persistent access-restricted local storage outside the repository. Never commit health records, exports, screenshots, database dumps, tokens, or key material.
- Keep the former private Donation Log Site and database as rollback copies until the user explicitly retires them.
