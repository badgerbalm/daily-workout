# Daily Workout

Personal workout viewer at https://badgerbalm.github.io/daily-workout/.

Daily workout data lives in `workout.json`. Continue publishing it with `/update`; exercise photos are selected automatically from the permanent name/alias library.

For `/plan` and `/update`, publish each timed plank set as its own exercise card. Keep the canonical name `Forearm plank`, identify the set in `detail`, and set `seconds` to the hold duration only. List the rest between sets in the instructions. Two one-minute holds with a one-minute rest take three minutes overall.

See [PHOTO_LIBRARY.md](PHOTO_LIBRARY.md) for coverage, missing photos, daily publishing compatibility, and how to add exercises. See [images/ATTRIBUTION.md](images/ATTRIBUTION.md) for photo sources and reuse licenses.

Verify repository assets and control regressions with:

```sh
node tests/verify-photos.cjs
```
