# Google backup & sync

This branch adds optional Google authorization and manual two-way synchronization of **finished daily sessions**. Unfinished sessions, form drafts and isolated interval-practice scenarios remain local. Google authorization is separate from Sites' existing owner-only sign-in. No server, refresh token or client secret is used by this static app.

## Configured Google project

- Project: `daily-workout-514201`
- Web client: `Daily Workout Web`
- Client ID: `790497358549-7lg9e6q8jbv08g1l3p4d1grm92o071js.apps.googleusercontent.com`
- Authorized JavaScript origins: `https://badgerbalm.github.io` and `https://daily-workout-safari-preview.badgerbalm.chatgpt.site`
- Redirect URIs: none; Google Identity Services uses its browser popup token model.
- Publishing status: Testing, with `onlinesny@gmail.com` as the test user.
- APIs required: Google Drive API (`drive.googleapis.com`) and Google Sheets API (`sheets.googleapis.com`). Both were enabled in the Cloud console on November 9, 2026.

The downloaded OAuth JSON is a private credential backup. Leave it outside the repository; do not upload it into the app or Sites. Only its public client ID appears in source. Credentials matching `client_secret*.json` are ignored by Git.

The app requests `openid email` to verify the personal account and `https://www.googleapis.com/auth/drive.file` for app-created files. It does not request access to all Sheets or all Drive files. Google documents this as a supported Sheets scope: https://developers.google.com/workspace/sheets/api/scopes . The configured account is checked against Google's UserInfo response rather than trusting the login hint. The access token stays in memory and must be obtained again after reopening or expiration. Disconnect clears the in-memory connection; it does not delete cloud or local records. Google Account's third-party connections page can revoke the app's grant.

## First use (Windows or iPhone)

1. Open https://badgerbalm.github.io/daily-workout/ and expand **Google backup & sync**. Production uses GitHub Pages; the ChatGPT preview is a migration fallback.
2. Tap **Connect Google** to load Google's library, then tap it again to open the account chooser. This second user tap preserves Safari popup behavior. Choose `onlinesny@gmail.com` and review Google's permissions yourself.
3. Tap **Sync now**. If no app-created history Sheet exists, select **Create private workout Sheet & sync**. Creation uses your Google account's default private ownership; the app never changes file sharing permissions.
4. Finish a workout using **Save workout**, then tap **Sync now** again. Current active logs are not uploaded. The Sheet link appears only after a successful verified sync.
5. On another device or browser origin, connect the same account and tap **Sync now** to restore finished history. A currently active workout is never replaced. Reload the workout to refresh previous-weight suggestions from restored history.

Back up local data with **Export local backup** before clearing browser storage. Local history existing in a preview cannot be read from the separate live GitHub Pages origin; sync it from the original preview first. An expired/canceled/blocked Google connection never blocks timers or local logging. Reconnect and retry Sync now. If APIs are disabled or access is denied, the app reports the required project/API checks without printing tokens or Google error payloads.

## Storage and recovery

The app discovers Sheets by the Drive `appProperties.dailyWorkoutFormat` marker (`daily-workout-finished-v1`), scoped to this OAuth client and account. Each immutable finished session has a stable ID and SHA-256 of a canonical snapshot. A row contains readable date/title/review columns and up to twenty 40,000-UTF-16-unit JSON chunks holding its full prescribed plan and actual results (units, weight basis, side, outcomes, ratings and notes). Chunk boundaries preserve surrogate pairs. Writes use `RAW`, so notes never become spreadsheet formulas. The first tab is used; do not reorder/delete its columns, change headers, or edit the record chunks. Renaming the tab is supported.

Every sync reads existing IDs before appending missing sessions and reads back the saved records before restoring locally. A lost append response can be retried without appending the same session again. Simultaneous identical appends from separate devices may leave physical duplicate rows; readback collapses these to one logical session. Different contents for the same finished ID, invalid headers, damaged chunks or multiple marked history Sheets stop sync without overwriting records. Resolve these with a local export and a copy of the Sheet; no automatic merge or deletion is attempted. New Sheet creation is rediscoverable after interruption. Two simultaneous first-time creations can produce multiple marked Sheets; create on one device first.

This is a backup and restore feature, not collaborative editing or background sync. Do not edit finished results in Sheets expecting them to update the app. The old local outbox remains reserved for future active-session sync; its pending events are not a cloud acknowledgment or queue for this finished-snapshot protocol. The UI reports cloud success only after explicit readback. Measurements, trends, generation access and unattended daily/Monday use are not implemented.

## Validation

`npm ci`, `npm run test:history`, and `npm run test:sync` cover IndexedDB, DOM behavior and synthetic Google REST responses. `tests/run-browser.cjs` also includes a real-browser mobile flow with mocked Google authorization/Sheets. These tests never upload personal health history. The owner completed real Google consent on November 9; private Sheet creation, header write/readback and an empty sync were verified in the preview. No completed workout record was fabricated. A real finished-workout sync remains to be exercised by the owner.

For browser checks on Windows, install Playwright locally (`npm install --no-save --package-lock=false playwright`), then in PowerShell:

```powershell
$env:CHROMIUM_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node tests/run-browser.cjs
```

Real iPhone Home Screen popup handling, Shortcuts and Apple Watch behavior remain device-validation tasks.
