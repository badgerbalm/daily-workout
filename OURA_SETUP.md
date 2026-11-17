# Oura API v2 setup

This integration keeps the existing 9 AM Eastern ChatGPT workout task. Oura sends daily score changes to the existing Cloudflare Worker through webhooks. The Worker retrieves the updated daily record and writes it to an **Oura Daily Scores** tab in the existing private Daily Workout Google Sheet. The ChatGPT task reads that tab using its existing Google Sheets connection. No new workout scheduler is added.

## Public Oura application details

After the GitHub Pages and Worker code are deployed, create a personal-use API application in the Oura Developer Portal and enter:

- Website: `https://badgerbalm.github.io/daily-workout/`
- Privacy Policy: `https://badgerbalm.github.io/daily-workout/privacy.html`
- Terms of Service: `https://badgerbalm.github.io/daily-workout/terms.html`
- Redirect URI: `https://daily-workout-auth.onlinesny.workers.dev/oura/oauth/callback`
- OAuth scope: `daily` only
- Webhook URL (managed by the Worker): `https://daily-workout-auth.onlinesny.workers.dev/oura/webhook`

The webhook URL is not an OAuth redirect URI. Oura’s webhook verification uses its own generated verification tokens and verifies event signatures with the Oura client secret.

## Secrets and data flow

Store these values as Cloudflare Worker secrets for `daily-workout-auth`; never put them in GitHub, `workout.json`, HTML, browser JavaScript, task instructions or a public file:

- `OURA_CLIENT_ID`
- `OURA_CLIENT_SECRET`

The Worker exchanges OAuth codes and refreshes tokens server-side. OAuth uses state and PKCE. When an Oura API request finds an expired access token, the Worker submits the saved refresh token, encrypts and saves the replacement access and refresh tokens in the existing `AUTH_DB` D1 database, then uses the new access token. Refresh tokens are single-use and rotate; storing the replacement before the next request is required. Daily score records are also encrypted in D1 until they are confirmed in the existing Google Sheet. The Oura tab stores readable score/date/contributor columns in that private Sheet, which is not encrypted by this app. The app does not change sharing permissions or create another spreadsheet. If no uniquely marked workout Sheet exists, the Worker keeps records in D1 and retries through the existing Worker cron.

The Worker subscribes to Oura `create` and `update` webhooks for `daily_sleep` and `daily_readiness`. It verifies webhook signatures, fetches the changed Oura record, and upserts that date in the Oura tab. Oura can update a day’s score, so that date’s Oura row is refreshed; workout history rows are separate and are not modified. The Worker reuses its existing daily maintenance cron to renew webhook subscriptions and retry pending Sheet writes; it does not add a scheduled workout generator.

Oura Sleep and Readiness data can be missing until the Oura mobile app syncs the ring. The stored day is Oura’s date, interpreted in the user’s local timezone. Never assume a previous day’s score is today’s score.

## First connection

1. Register the callback URI exactly as shown above in the Oura Developer Portal.
2. Save the Oura Client ID and Client Secret as Worker secrets using Wrangler. Run these commands from the repository root; Wrangler prompts for each value, so do not put a value in the command line, chat or repository:

   ```powershell
   node C:\Projects\parley-pickem-live\node_modules\wrangler\bin\wrangler.js secret put OURA_CLIENT_ID --name daily-workout-auth
   node C:\Projects\parley-pickem-live\node_modules\wrangler\bin\wrangler.js secret put OURA_CLIENT_SECRET --name daily-workout-auth
   ```

3. Apply the additive schema to the existing D1 database, then deploy the Worker with its existing binding:

   ```powershell
   node C:\Projects\parley-pickem-live\node_modules\wrangler\bin\wrangler.js d1 execute daily-workout-auth --remote --file backend/schema.sql
   node C:\Projects\parley-pickem-live\node_modules\wrangler\bin\wrangler.js deploy --config wrangler.jsonc
   ```

   These commands use the existing `CLOUDFLARE_API_TOKEN` environment variable. It must have permission to edit this Worker and the existing D1 database. Do not recreate the database or rotate `TOKEN_ENCRYPTION_KEY`.
4. Publish the site so `privacy.html` and `terms.html` are available at the public URLs above.
5. In the production workout app, connect Google in the current browser if needed, open the menu, expand **Oura sleep & readiness**, and select **Connect Oura**. Review the Oura consent page and grant `daily` access.
6. Open the Oura mobile app and sync the ring. The Worker backfills the most recent week and then maintains the Sheet from Oura webhooks. Use **Refresh Oura scores** if a recent Oura sync happened before the webhook arrived.
7. Confirm the private workout Sheet has an **Oura Daily Scores** tab. The ChatGPT task should read that tab and distinguish today’s row from older rows.

## ChatGPT 9 AM task instructions

Keep the current task schedule and add a source instruction similar to:

> Read the `Oura Daily Scores` tab in my existing private Daily Workout Google Sheet. Use the row whose Date matches today in America/New_York. Report the Sleep Score and Readiness Score with their stored dates and available contributors. If today’s row or a score is missing, say it is unavailable; do not substitute an older score without labeling its date. Treat these as wellness estimates, not medical advice.

The ChatGPT task does not receive Oura credentials or a direct Oura access token. It reads only the score rows through the connected private Sheet.

## Disconnect and removal

**Disconnect & clear stored Oura data** removes Oura credentials and score records from the application’s D1 database and attempts to remove the Oura webhook subscriptions. The Oura Daily Scores rows already copied to Google remain in the Sheet; remove those rows there if desired. Revoke the application from Oura account settings as well if you want to revoke Oura’s authorization independently.

## Recovery

If Oura scores stop updating, sync the ring in the Oura mobile app, then select **Refresh Oura scores** in Daily Workout. Check that the existing Google connection can still access the marked private workout Sheet. If the Oura consent was revoked or the refresh token is rejected, reconnect Oura. Never create a second workout spreadsheet to resolve a sync issue.
