# Daily Workout

Personal workout viewer at https://badgerbalm.github.io/daily-workout/.

Daily workout data lives in `workout.json`. Continue publishing it with `/update`; exercise photos are selected automatically from the permanent name/alias library.

For `/plan` and `/update`, publish each timed plank set as its own exercise card. Keep the canonical name `Forearm plank`, identify the set in `detail`, and set `seconds` to the hold duration only. List the rest between sets in the instructions. Two one-minute holds with a one-minute rest take three minutes overall. Side planks follow the same behavior: one card and hold-only timer for each side of each set, with the side and set in `detail` and canonical name `Side planks`. Never combine multiple plank holds in one timer. Preserve the prescribed hold times and overall block duration, including rest.

When splitting cards within an already published workout, optional `progressKey` preserves existing checkbox identities for following exercises. Optional `legacyProgressKey` lets split holds inherit a previously completed combined card; a hold’s own saved checkbox value takes precedence. The October 24 side plank split uses four 30-second holds with 20 seconds of manual rest after each of the first three holds, retaining the three-minute block.

See [PHOTO_LIBRARY.md](PHOTO_LIBRARY.md) for coverage, missing photos, daily publishing compatibility, and how to add exercises. See [images/ATTRIBUTION.md](images/ATTRIBUTION.md) for photo sources and reuse licenses.

Verify repository assets and control regressions with:

Non-treadmill timers track the requested duration from the Start button tap. When that duration expires, the page marks the started exercise complete and advances, either while Safari runs or on the next return/refresh. Treadmill and indoor-walk sections retain manual completion and the existing Walk Start/End shortcuts. Manual Done clears pending automatic completion and, for that exercise’s active Apple Watch/MultiTimer timer outside walking sections, launches Workout Timer Stop after saving the check and advancing. Completing a different card does not stop the active timer. Starting another timer replaces the previous tracked timer, and changing the workout invalidates stale timers. The next exercise's timer is never started automatically.

In Apple Watch mode, expiration outside walking sections launches the tested `Workout Timer Stop` shortcut (MultiTimer Reset TIMER, then Go to Home Screen). Completion is saved before the launch, so reopening the web app never triggers it twice. If Safari is hidden, the launch waits for the next visible refresh. iPhone Clock mode never invokes this MultiTimer reset shortcut.

The page cannot verify that the shortcut ran or inspect external timer status. Requested-duration tracking does not reflect timers canceled or changed in MultiTimer. Locked/background Safari does not provide a guaranteed timer-end trigger; the page catches up on return.

```sh
node tests/verify-photos.cjs
```

## Watch strength and core sections

Set `watchWorkout: "strength"` or `"core"` on the section during `/plan` and `/update`; `"none"` explicitly disables detection. Legacy titles have fallback recognition. A combined strength/core section records one strength workout; use separate sections for separate recordings. No timing or exercise changes are required.

In Watch mode, the first timer tapped in a section launches `Workout Strength Start` or `Workout Core Start` with that exercise's seconds. These shortcuts start Functional Strength Training/Core Training, start TIMER using the passed duration, and Go to Home Screen. Later timers use Workout Timer Watch without starting a new Watch workout. Final Done (including timer-expiry completion) consumes the section state and runs the shared `Workout Walk End` shortcut, which must Reset TIMER, End Workout, then Go to Home Screen. Do not end the Watch workout in Workout Timer Stop.

The section’s final Done ends the tracked Watch recording, including after reopening the app. Finish that tracked session before starting another section. Reopening never reruns start/end automatically. These are requested actions, not verified Watch state. If ending is canceled, run Workout Walk End manually. The app cannot query Watch recording state or automatically reopen the Home Screen web app. Existing iPhone timer mode and treadmill boundaries are preserved.

## iPhone layout and photo validation

The interface is designed for an iOS Home Screen web app, including safe-area spacing, large touch targets and expandable timer settings. Shortcuts finish with Go to Home Screen; tap the app icon to continue. The page cannot reopen itself or verify on-device actions.

Run the independent checks:

```sh
node tests/verify-photos.cjs
node tests/verify-watch-lifecycle.cjs
node tests/verify-photo-audit.cjs
node scripts/audit-photos.cjs --strict
# With Playwright and Chromium available (no separate server needed):
node tests/run-browser.cjs
```

The strict photo audit intentionally fails if any prescribed movement lacks a photo or has only partial coverage. Do not bypass it when claiming complete photo coverage. The registry/renderer check accepts explicitly documented missing entries, while checking all existing file hashes and attribution. Mobile behavior tests use fixed synthetic plans rather than a particular day's workout.

Current November 7 plan: 9 of 13 cards have complete photo coverage, one has partial coverage, and three have no photos. Standing calf stretch now has a public-domain heel-placement photograph, and shoulder rolls/arm circles has an explicitly labeled arm-circle-only still. The shoulder-roll portion still needs a photo. Standing hip flexor stretch, supine figure-four stretch, and dumbbell floor press have verified external demonstration-page links, but their media remain copyrighted and are not copied or hotlinked. The strict audit still fails for these incomplete cards.

## Reopening after Shortcuts

Start timer saves the selected exercise before leaving. Done saves the following exercise before any reset/end Shortcut. A full reopening restores that exercise for the exact same published plan; ordinary browsing also saves the visible card and offset when leaving. Remembering a position never checks an exercise or starts another timer. A changed plan ignores the old bookmark. The app still needs to fetch its plan: this is navigation persistence, not offline workout storage or the future private history system.

Done names the next exercise but does not start its timer. Starting that next timer retains the established inferred-completion behavior. Checkbox and Done updates merge with saved checks so they cannot erase completions written by Start. The browser suite includes cold and warm reopening, merged checks, expired timers, manual browsing, and changed/corrupt bookmarks. Actual iOS Home Screen behavior still needs device testing.

## Isolated Safari Shortcut preview

`node scripts/build-preview.cjs /absolute/preview/dist` copies only the public app files and image library, then enables preview-only Shortcut routing. The regular app always uses original Shortcut names, even if a stale Safari-test preference exists in storage.

The private preview is hosted with Sites at https://daily-workout-safari-preview.badgerbalm.chatgpt.site/ and includes a linked `safari-test.html` setup guide. It is a snapshot of the published prescription at build time; the existing 5 AM task does not update this separate preview. Sign in with the owning ChatGPT account if prompted. Preview checks and timer records are isolated from the live GitHub Pages origin.

Append ` Safari Test` to each original Shortcut name, preserve all timer/Watch actions and supplied seconds, and replace the final Go to Home Screen with URL and Open URLs pointing to the preview root. Start with Workout Timer Watch Safari Test and Workout Timer Stop Safari Test on a mobility card. Duplicate the walk start/end, strength start, core start, and iPhone timer before testing those paths. The page pins the selected Shortcut set while a requested timer or Watch recording is tracked; timer-only Stop does not unlock an ongoing Watch section.

Run `node tests/verify-safari-shortcuts.cjs` for deterministic routing/lifecycle coverage. On-device testing is still needed for Safari tab reuse, return navigation, actual MultiTimer resets and Watch recording. The website cannot control Safari tab reuse or inspect device actions. No private history synchronization is supplied by preview hosting.
