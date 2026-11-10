# Google backup & sync

Google authorization powers two saves. The latest daily workout state (including unfinished exercises and drafts) autosaves to the dedicated Cloudflare D1 database, so Safari and the Home Screen app can load the same current session. **Sync now** separately performs verified two-way backup and restore of finished history in a private Google Sheet. Practice scenarios remain isolated. Google authorization is separate from Sites' existing owner-only sign-in.

## Configured Google project

- Project: `daily-workout-514201`
- Web client: `Daily Workout Web`
- Client ID: `790497358549-7lg9e6q8jbv08g1l3p4d1grm92o071js.apps.googleusercontent.com`
- Authorized JavaScript origins: `https://badgerbalm.github.io` and `https://daily-workout-safari-preview.badgerbalm.chatgpt.site`
- Registered backend redirect URI: `https://daily-workout-auth.onlinesny.workers.dev/oauth/callback`.
- Publishing status: In production, confirmed November 9, 2026. The backend still accepts only `onlinesny@gmail.com`.
- APIs required: Google Drive API (`drive.googleapis.com`) and Google Sheets API (`sheets.googleapis.com`). Both were enabled in the Cloud console on November 9, 2026.

The downloaded OAuth JSON is a private credential backup. Leave it outside the repository; do not upload it into the app or Sites. Only its public client ID appears in source. The owner explicitly approved storing the client secret in Cloudflare encrypted secrets on November 9, 2026; it never enters the frontend. Credentials matching `client_secret*.json` are ignored by Git.

The app requests `openid email` to verify the personal account and `https://www.googleapis.com/auth/drive.file` for app-created files. It does not request access to all Sheets or all Drive files. Google documents this as a supported Sheets scope: https://developers.google.com/workspace/sheets/api/scopes . The configured account is checked against Google's UserInfo response rather than trusting the login hint. Google access and refresh tokens stay encrypted in the backend database. This browser stores a revocable opaque app session, valid up to 90 days (or the Google grant limit). Disconnect deletes the current browser session without deleting workout records. Google Account's third-party connections page can revoke the app's grant.

## First use (Windows or iPhone)

1. Open https://badgerbalm.github.io/daily-workout/ and expand **Google backup & sync**. Production uses GitHub Pages; the ChatGPT preview is a migration fallback.
2. Tap **Connect Google** once in Safari and once in the Home Screen app. Google opens in that browser context; choose `onlinesny@gmail.com` and review Google's permissions. Each context remembers its connection.
3. After connection, the active workout automatically loads from and saves to shared D1 state. Exercise results, drafts and completion status save as you change them. Refreshing/reopening either context retrieves the latest save; conflicting simultaneous edits use the most recently saved version.
4. **Sync now** separately backs up and restores finished history in Google Sheets. If no app-created history Sheet exists, select **Create private workout Sheet & sync**. Sheet creation is optional for shared autosave.

Back up local data with **Export local backup** before clearing browser storage. Local history existing in a preview cannot be read from the separate live GitHub Pages origin; sync it from the original preview first. An expired/canceled/blocked Google connection never blocks timers or local logging. Reconnect and retry Sync now. If APIs are disabled or access is denied, the app reports the required project/API checks without printing tokens or Google error payloads.

## Storage and recovery

The app discovers Sheets by the Drive `appProperties.dailyWorkoutFormat` marker (`daily-workout-finished-v1`), scoped to this OAuth client and account. Each immutable finished session has a stable ID and SHA-256 of a canonical snapshot. A row contains readable date/title/review columns and up to twenty 40,000-UTF-16-unit JSON chunks holding its full prescribed plan and actual results (units, weight basis, side, outcomes, ratings and notes). Chunk boundaries preserve surrogate pairs. Writes use `RAW`, so notes never become spreadsheet formulas. The first tab is used; do not reorder/delete its columns, change headers, or edit the record chunks. Renaming the tab is supported.

Every sync reads existing IDs before appending missing sessions and reads back the saved records before restoring locally. A lost append response can be retried without appending the same session again. Simultaneous identical appends from separate devices may leave physical duplicate rows; readback collapses these to one logical session. Different contents for the same finished ID, invalid headers, damaged chunks or multiple marked history Sheets stop sync without overwriting records. Resolve these with a local export and a copy of the Sheet; no automatic merge or deletion is attempted. New Sheet creation is rediscoverable after interruption. Two simultaneous first-time creations can produce multiple marked Sheets; create on one device first.

The shared current-workout save is autosynced through the authenticated Worker and stored encrypted at rest in D1. Google Sheets remains a finished-history backup; editing Sheet rows does not change the current workout. Cloud saves require an internet connection and a Google connection in each browser context. If the network is unavailable, local IndexedDB remains available and the next app load/field save retries. Measurements, trends, generation access and unattended daily/Monday use are not implemented.

## Validation

`npm ci`, `npm run test:history`, and `npm run test:sync` cover IndexedDB, DOM behavior and synthetic Google REST responses. `tests/run-browser.cjs` also includes a real-browser mobile flow with mocked Google authorization/Sheets. These tests never upload personal health history. The owner completed real Google consent on November 9; private Sheet creation, header write/readback and an empty sync were verified in the preview. No completed workout record was fabricated. A real finished-workout sync remains to be exercised by the owner.

For browser checks on Windows, install Playwright locally (`npm install --no-save --package-lock=false playwright`), then in PowerShell:

```powershell
$env:CHROMIUM_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node tests/run-browser.cjs
```

Real iPhone Home Screen popup handling, Shortcuts and Apple Watch behavior remain device-validation tasks.

## Remembered connection deployment

Worker: `daily-workout-auth`, URL `https://daily-workout-auth.onlinesny.workers.dev`. D1 binding `AUTH_DB`; schema `backend/schema.sql`; config `wrangler.jsonc`. Secrets `GOOGLE_CLIENT_SECRET` and `TOKEN_ENCRYPTION_KEY` are configured separately. Never regenerate the encryption key while saved connections exist. Neither Google tokens nor app session tokens are logged. OAuth uses one-time state, server PKCE, and a separate one-time ticket bound to the initiating browser verifier. Only the configured owner can connect.

The exact callback above was saved in Google Auth Platform → Clients → Daily Workout Web on November 9, 2026. The public homepage and privacy page were also saved. The owner approved production publishing, and Google confirmed In production on November 9, 2026. This removes the seven-day Testing refresh-token limit; revocation and other Google expiry rules still apply. The backend owner-account restriction remains. Complete owner consent, reload, and verify Sync now against the existing private Sheet. Actual iPhone return-to-Home-Screen behavior still needs owner validation; if Google returns to a different browser context the app rejects the handoff safely and asks to reconnect there.

Run `npm run test:auth`, `npm run test:history`, and `npm run test:sync`. Deployment: apply the schema through the Cloudflare D1 query API, then `npx wrangler deploy`. Keep `observability.enabled` false to avoid request logging of OAuth callbacks. Backend health and missing-session checks are safe without Google credentials.
