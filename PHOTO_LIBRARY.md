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
5. Add source and license details to `images/ATTRIBUTION.md`. Links to the original source and license also appear beside the workout card. Tap a photograph to expand it in a dialog. The Back to workout button closes it without reloading or losing your place; Escape also closes it.
6. Run `node tests/verify-photos.cjs` and visually inspect desktop and mobile widths. The checks verify registered current exercises and every local file's SHA-256, as well as timer and completion behavior.

No workout instruction, duration, set, rep, or exercise was changed by this integration. `workout.json` remains byte-for-byte unchanged.

## October 24 additions

The October 24 workout has 27 cards. Photos cover all 27 cards after adding explicit walking-interval aliases and five additional movements: glute bridges, dumbbell Romanian deadlifts, resistance-band lateral steps, side planks, and dead bugs.

- Glute bridges, dumbbell Romanian deadlifts, and side planks have two real photographic positions each.
- Resistance-band lateral steps use photographic panel I from de Carvalho et al. (2026), licensed CC BY 4.0. The band-walk video initially researched carries additional copyright restrictions and was not used.
- Dead bugs use the photographed starting position from Tsartsapakis et al. (2023), licensed CC BY 4.0. This is explicitly captioned as the start, not a complete movement sequence.
- The Romanian deadlift photographs are stills from a public-domain U.S. Marine Corps demonstration, with author credit, source, extraction timestamps, and the required non-endorsement notice. No Navy videos carrying third-party copyright restrictions were used.
- Lying quad stretch uses an owner-supplied StretchCoach photograph, with its watermark retained and its reuse license recorded as unspecified.

The October 24 workout data, timing, saved-progress behavior, and Shortcut links were not edited for these photo additions. The regression check now derives the last walking card from the current section length so interval workouts also receive the walking-end check.

## Owner-supplied suitcase carry reference

The site owner supplied `images/suitcase-carry-comparison.png` and selected https://www.youtube.com/watch?v=rFIUiO-P1jo on October 24, 2026. The original image is preserved unchanged, and its caption identifies the suitcase carry on the left, distinct from the farmer’s carry on the right. The image is recorded as user-supplied with an unspecified reuse license, not as Creative Commons or public domain.

The optional `demo` field in a library entry supplies a permanent HTTPS demonstration link for all its aliases. It takes precedence over a daily workout’s `demo`, so future `/update` publishes reuse the selected video automatically. Workout data and timer behavior are unchanged.

The owner supplied clearer bent-knee leg raise photographs, replacing the initial thumbnail with low and raised positions. Both uploaded files are stored locally unchanged. The owner-selected motion demonstration is linked from the card: https://www.youtube.com/watch?v=T31_qyE7Xqw. The third uploaded frame shows a higher pelvic curl and was not substituted for the controlled leg raise. Original creators and reuse licenses remain unspecified; no open license is claimed. Current coverage is 27 of 27 cards after the owner-supplied lying quad stretch photograph was added.

## Animated demonstration references

An optional HTTPS `animationPage` field adds an Animated demonstration & form guide link to the exercise card, independently of the current workout. Bent-knee leg raises link to https://www.calixpert.com/exercises/laying-bent-leg-raises alongside the selected YouTube video. The source page uses an 80-frame, 480 × 480 GIF hosted by Giphy. The uploaded PNG has one frame. No open reuse license for the source animation was verified, so the GIF is not copied into this repository or hotlinked as a card image.

Calixpert may be consulted as a demonstration reference for future additions; this does not automatically add exercises to a workout or establish permission to redistribute its media.

Owner-provided exercise directory: https://www.calixpert.com/exercises (added October 24, 2026). Consult this searchable directory when sourcing demonstrations for future library entries. Verify the exact exercise variation and individual media reuse rights; link to the original guide when redistribution permission is unverified. Save each selected exercise-specific URL in its library entry so routine `/plan` and `/update` use does not require a new search.

## Owner-supplied lying quad stretch

The owner supplied `images/lying-quad-stretch.png` on October 24, 2026. The original PNG is stored unchanged with the StretchCoach watermark visible. The watermark is credited, the source website is linked, and no open reuse license is claimed. All 27 current workout cards now have local photographs; other exercises in the broader library may still have missing entries.
