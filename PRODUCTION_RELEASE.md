# November 9, 2026 production cutover

Production uses the existing GitHub Pages address: https://badgerbalm.github.io/daily-workout/ . The new interface replaces the old app at that address. The ChatGPT Site remains a private migration fallback, not a second daily-workout destination; do not delete its browser storage or hosting until any finished history is synced and iPhone Shortcuts point to production.

The release preserves `workout.json` exactly from main commit `eae8763`, the published November 9 plan. It does not substitute `workout-practice.json`, add interval blocks, alter prescribed exercise amounts, or rename an older workout as today's plan. Existing daily publishing continues through main's workout.json. Google history is separate from the public prescription and is not automatically used by the generation task.

Production defaults to the Safari Shortcut set. Rename the former Safari Test Shortcuts to the same names ending in **Safari**, and set each final URL/Open URLs action to `https://badgerbalm.github.io/daily-workout/`. Exact names and actions are listed in [Safari setup](safari-setup.html). The existing original-name Home Screen option remains available. Individual practice scenarios stay isolated from daily history.

The Google OAuth client already allows `https://badgerbalm.github.io`. On production, connect `onlinesny@gmail.com` and tap Sync now to discover the same app-created Sheet. The browser needs a new Google authorization because tokens are memory-only. Preview local drafts/unfinished workouts are origin-specific and are not transferred. Finish or export anything needed from the old origin before abandoning it.

Live owner Google consent, private Sheet creation, header write/readback and an empty sync were verified on the private preview. It reported zero finished workouts; no fictitious workout was created for validation. Finished-result round trips, duplicate/lost-response handling and recovery are covered with synthetic data. Real iPhone/Watch execution remains an owner validation step after renaming the device Shortcuts.

Release validation: local history and sync unit/DOM suites, deterministic Safari routing, photo/hash attribution and mobile Edge regressions. Production routing coverage checks renamed Safari starts/stops/ends, the saved-review barrier, readable labels and the return URL guide. No credential JSON, access tokens, actual logs or private Sheet identifier belong in this repository.

Rollback: revert the release merge on main through a reviewable commit if necessary; do not delete or reset workout history. Keep the current workout.json when rolling back UI code so the prescription does not revert to an earlier date. Preserve the private Sheet and use local export for any browser history before changing storage.
