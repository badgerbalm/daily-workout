# Permanent exercise photograph library

`exercise-photos.json` is the source of truth for photographs, independent of `workout.json` and the workout date. `exercise-photos.js` matches exercise names and aliases and renders at most two local photographs, with visible credits. Unknown exercises and failed files display a text placeholder. Legacy per-workout image URLs are intentionally ignored, so stale hotlinks or SVG illustrations cannot override this library.

## Daily /plan and /update

Continue using the existing workout structure and commands. For registered exercises, only the existing exercise `name` is needed. `/update` can replace `workout.json` without changing or searching for photos. Do not regenerate `index.html`, `exercise-photos.js`, `exercise-photos.json`, or `images/` during routine workout updates. Existing optional image fields remain compatible with the workout schema but do not control the displayed library photograph.

An unrecognized new exercise displays a clean placeholder until a suitable licensed photo is added. Exercise names must match a canonical name or listed alias; case, repeated spaces, and straight/curly apostrophes are normalized.

## Coverage as reviewed October 20, 2026

12 of the current 17 exercise entries have photos. The four walking phases share one photograph of treadmill walking; speed and phase instructions remain on each card. This is 9 distinct photographed movements, not 12 different movements.

| Exercise | Photos | Notes |
| --- | ---: | --- |
| Lying quad stretch | 0 | Missing: no verified reusable photograph of the side-lying movement |
| Butterfly stretch | 1 | Existing correct photo saved locally |
| Seated spinal twist | 1 | Replaces the processed silhouette with a real photograph |
| Plow Pose (Halasana) | 1 | Existing correct photo saved locally |
| Easy warm-up | 1 | Treadmill walking photo |
| Steady walk | 1 | Same walking movement, follow the card's pace |
| Brisk walk | 1 | Same walking movement, follow the card's pace |
| Cool-down | 1 | Same walking movement, follow the card's pace |
| Dumbbell floor press | 0 | Missing: rejected bench/stability-ball press and barbell illustrations |
| Supported one-arm dumbbell row | 2 | Starting and finishing panels from the same composite photograph |
| Lateral raises | 2 | Starting and finishing panels from the same composite photograph |
| Forearm plank | 1 | Existing class photograph saved locally |
| Side steps with arm swings | 0 | Missing: no verified exact movement photograph |
| Cloud hands | 1 | Source explicitly identifies Wave Hands Like Clouds; not a claimed start/end sequence |
| Alternating forward steps | 0 | Missing: no verified exact movement photograph |
| Parting the horse's mane | 2 | Beginning/end photographic panels of Figure 3 in Huang (2024) |
| Brush knee and push | 0 | Missing: reviewed open-access figures were skeletal models rather than photographs |

## Existing-image audit

The original workout had 7 remote image references on 6 entries and 11 entries with no image. All referenced Commons file titles resolved through the Commons image API during research; this does not guarantee dependable hotlink delivery. The old Cloud Hands image title was normalized by Commons. The spinal-twist image was a heavily processed silhouette, inappropriate for a photographs-only library. Both the old Tai Chi class source and its license were checked: its description explicitly names Cloud Hands. The separate Manuel Schroeder photos were not used as a fabricated start/end sequence. Attribution was previously a generic source link, with incomplete license details for some assets. Unused SVG illustrations and the old inline drawing generator were removed.

## Add an exercise later

1. Find a real photograph of the exact movement and verify the source license, author, required attribution, and any reuse restrictions. Do not infer an image license from a software repository's code license.
2. Save the image under `images/` using a descriptive filename. For two frames, prefer a documented sequence of the same exercise and person. Do not label unrelated poses as start/end.
3. Add a canonical entry and aliases to `exercise-photos.json`. Retain `status: "missing"`, `photos: []`, and a reason when a suitable photograph cannot be verified.
4. Each photo needs `src`, `alt`, `title`, `author`, `source`, `license`, `licenseUrl`, `changes`, `width`, `height`, and `sha256`. `caption`, `citation`, and `attributionUrl` are optional. Record cropping/resizing and retain the applicable share-alike license on derivatives.
5. Add source and license details to `images/ATTRIBUTION.md`. Links to the original source and license also appear beside the workout card. Tap a photograph to open the full local file.
6. Run `node tests/verify-photos.cjs` and visually inspect desktop and mobile widths. The checks verify registered current exercises and every local file's SHA-256, as well as timer and completion behavior.

No workout instruction, duration, set, rep, or exercise was changed by this integration. `workout.json` remains byte-for-byte unchanged.
