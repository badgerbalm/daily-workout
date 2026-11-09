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

## Stale Watch tracking recovery

If the Watch is no longer recording but a section remains saved, open Timer & Watch settings and select **Watch is stopped · clear saved tracking**. A conflicting section start opens this inline recovery instead of a blocking alert. Clearing tracking removes only the page’s pending Watch/timer routing state; it does not launch a Shortcut or change completed exercises. Tap Start timer again afterward. The page cannot verify actual Watch recording state. No floating End Watch or Stop timer controls are displayed.

A compact Start timer button appears to the right of the exercise title in a two-column heading. Long titles wrap in the left column; the timer stays in the right column, before instructions, photo credits, and images. Done and Shortcut returns target that timer control rather than the card top. Starting the next timer remains an explicit tap; navigation alone does not start it. Ordinary browsing offsets are still preserved.

## Compact cards during a workout

Starting an exercise collapses that card’s photo, leaving more room for the next card. Show photo reopens it at any time, and the photo/expanded-view controls remain available. Photo visibility is saved locally for the exact plan and survives Shortcut returns; a changed plan starts expanded. This presentation state is separate from completion checks and does not confirm actual performance. Section numbers, exercise counts, a current-card accent and brighter timer controls make the sequence easier to scan. No floating controls are added.

Workout settings includes Parley-inspired Game day, Steelers, Bills, Giants, Colts and Classic color themes. Selection is local to this browser. Done/Next remains a filled, high-contrast button in every palette.

## Established opening stretch

The first stretch is **Single lean-back quad stretch**, shown in the owner-supplied StretchCoach photo at `images/lying-quad-stretch.png`: seated on the floor, one leg straight, the other foot beside the buttock, leaning back with support. Do not substitute a standing calf stretch. The legacy name Lying quad stretch resolves to this exact photo; side-lying quad aliases were removed because they describe a different movement. This correction does not prescribe new repetitions or hold durations.

The second established opening stretch is **Butterfly stretch**, using its existing registered photograph. Do not substitute Standing hip flexor stretch. Keep the prescribed duration unless the user changes it.

The reported opening sequence also includes **Plow pose with feet suspended** (straight legs), replacing Supine figure-four stretch. This records the user’s movement, not a claim that it treats a back condition. The existing one-minute timer is retained. Its current photograph is explicitly marked as a floor-contact reference, and the registry flags partial photo coverage until an exact-variation photo is available. Do not progress toward floor contact or increase duration automatically.

The user selected **Dumbbell bench press with feet on the floor**, replacing the floor press. The preview retains 2 × 10 and the existing 180-second timer; no actual weight or performance is inferred. Verified local demonstration stills show the selected setup.

Photo-library metadata is refreshed alongside each workout reload, including returns from Shortcuts, so newly registered exercise photos do not remain missing in an already-open tab. Local photo assets and clean missing-photo placeholders are unchanged.

## Side-plank interval practice

The private preview supports `?scenario=side-planks`, with one card and completion checkbox for the whole sequence, four explicit 30-second hold stages, and one block launcher for **Workout Side Planks Safari Test**. The Shortcut should Reset TIMER, Reset Side Planks, Start Side Planks using its configured intervals, then Open Safari. It requests no Watch workout recording. The saved timer sequence is left 30s, switch 5s, right 30s, rest 30s, left 30s, switch 5s, right 30s; the displayed 2:45 includes the Get ready 5s seen in the device configuration.

Scenario timer/Watch/bookmark/card-state keys and checkbox date are isolated from the daily plan. Starting/restarting requests the sequence and leaves all four holds unfinished; reopening restores the pending request without relaunching. Only checking the block’s single checkbox confirms completion. There is no inferred per-interval completion or claimed device telemetry. If stopped early, the user stops the block in MultiTimer and leaves unfinished holds unchecked. The main workout prescription is unchanged.

The same isolated single-card workflow also supports `?scenario=planks` and `?scenario=suitcase-carries`. **Workout Planks Safari Test** targets a saved Planks timer configured as 60s hold, 60s rest, 60s hold (3:00). **Workout Suitcase Carries Safari Test** targets Suitcase Carries configured as left 30s, switch 5s, right 30s, rest 30s, left 30s, switch 5s, right 30s (2:40). These two timers have no preparation interval or final rest. Both Shortcuts Reset TIMER, reset/start their named interval timer, then Open Safari. Actual load, performance and recovery are not inferred from these prescriptions. Each scenario has separate local request, routing, navigation and checkbox state.

The user reports the side-plank sequence is workable but one rest-boundary alert is missing. This remains an on-device MultiTimer alert-setting issue to investigate; the page has no interval telemetry or alert control.

## Combined workout preview

The Sites preview build serves `workout-practice.json` as its root workout.json; the source `workout.json` and live GitHub Pages prescription remain unchanged. This walkthrough adds the tested single-card carry block to strength and plank blocks to core. Regular exercises begin Watch recording as before; block starts require that section’s recording to be tracked, and keep it running rather than starting a second recording. A direct block start before that first regular exercise shows inline instructions.

Blocks are only user-confirmed, never auto-completed by elapsed time or a different Start button. One pending block prevents starting a different exercise until it is confirmed or its tracking is cleared after stopping devices. Intermediate completion requests Workout Timer Stop; final section completion requests Workout Walk End. Both Safari-test Shortcuts must reset TIMER and all three named interval timers; only Walk End also ends Watch recording. The app cannot verify those on-device actions. Reopening never relaunches a requested block. Clearing saved tracking after stopping early leaves the block unfinished.

The Safari-test shared end Shortcut is now **Workout End Safari Test**. The original non-test integration retains Workout Walk End for compatibility. Workout Timer Stop Safari Test remains timer-only and must not end Watch recording. The shared End sequence is all workout-timer resets, End Workout, then Open Safari.

## Local workout results preview

The results preview stores entries in IndexedDB on the current browser/device. It snapshots the prescribed plan when logging starts and resumes that snapshot even if the published plan changes. Actual reps, weights, weight basis and side start blank; walk forms suggest the prescribed duration and upper speed/incline using dropdowns, but save those as actual performance after per-card confirmation or Finish Workout for walks marked done; previous entered weights are offered only through an explicit button. Timer expiry and next-start completion remain navigation inferences requiring confirmation. Skipped and unfinished exercises retain their own states.

Finish Workout saves effort (1–10), energy (1–5), discomfort (0–10) and optional notes without converting unfinished exercises to completed. Entries and review drafts are saved before Shortcut handoff. Recent results and an Export local backup button are available on the same device. Clearing browser storage can remove these entries; Safari and a standalone app may use different storage contexts.

There is **no Google sign-in, Google Sheet, cloud backup or synchronization yet**. The local outbox uses stable event IDs for future synchronization, but no history is transmitted. Do not add actual entries, exports, measurements or credentials to this repository or workout.json. Measurements, trends and history-informed generation remain future work.

Run `npm ci` and `npm run test:history` for IndexedDB transaction and DOM workflow regressions. These use fake-indexeddb and jsdom, not real iPhone or Watch testing. On-device validation must cover entry, leaving for Shortcuts, reopening, confirming/skipping and finishing before this milestone is considered device-tested.
