# Daily Workout

Personal workout viewer at https://badgerbalm.github.io/daily-workout/.

Daily workout data lives in `workout.json`. Continue publishing it with `/update`; exercise photos are selected automatically from the permanent name/alias library.

For `/plan` and `/update`, publish each timed plank set as its own exercise card. Keep the canonical name `Forearm plank`, identify the set in `detail`, and set `seconds` to the hold duration only. List the rest between sets in the instructions. Two one-minute holds with a one-minute rest take three minutes overall.

See [PHOTO_LIBRARY.md](PHOTO_LIBRARY.md) for coverage, missing photos, daily publishing compatibility, and how to add exercises. See [images/ATTRIBUTION.md](images/ATTRIBUTION.md) for photo sources and reuse licenses.

Verify repository assets and control regressions with:

Non-treadmill timers track the requested duration from the Start button tap. When that duration expires, the page marks the started exercise complete and advances, either while Safari runs or on the next return/refresh. Treadmill and indoor-walk sections retain manual completion and the existing Walk Start/End shortcuts. Manual Done clears pending automatic completion. Starting another timer replaces the previous tracked timer, and changing the workout invalidates stale timers. The next exercise's timer is never started automatically.

In Apple Watch mode, expiration outside walking sections launches the tested `Workout Timer Stop` shortcut (MultiTimer Reset TIMER, then Open Safari). Completion is saved before the launch, so returning to Safari never triggers it twice. If Safari is hidden, the launch waits for the next visible refresh. A Stop timer · return to Safari button provides a user-tap fallback when automatic external-app navigation is blocked; starting any new timer clears the old fallback. iPhone Clock mode never invokes this MultiTimer reset shortcut.

The page cannot verify that the shortcut ran or inspect external timer status. Requested-duration tracking does not reflect timers canceled or changed in MultiTimer. Locked/background Safari does not provide a guaranteed timer-end trigger; the page catches up on return.

```sh
node tests/verify-photos.cjs
```
