# Backlog

If you are a human, say to an Agent: **"Read docs/backlog.md and do item N"**

If you are an AI Agent, first read: `docs/README.md` and understand our intent and architecture.

Then always make sure to follow the [AI Workflow](./guide/ai-workflow.md) (orient → design → plan → implement → validate → wrap up).

At the end: update design doc status → Implemented, update specs to match what was actually built, update `docs/features/<feature>/index.md`, then review and add any learnings to `docs/guide/ai-workflow.md`. Once a finished item has a shipped design + spec linking back to it, delete the backlog entry — the spec is the durable record, not this file.

---

## 23

**Back-annotate `@spec` headers across all modules + spec back-links.** Convention + checker shipped 2026-04-19 (see [docs/guide/spec-linking.md](./guide/spec-linking.md) and `tools/scripts/check-spec-links.mjs`). Pilot done on `modules/video-analysis` (3 files + 2 spec tasks). Remaining: 19 unlinked modules (`achievements`, `auth`, `body-review`, `cycle-review`, `cycle-tracking`, `disruptions`, `feature-flags`, `formula`, `gym-partners`, `history`, `jit`, `onboarding`, `profile`, `program`, `session`, `settings`, `training-volume`, `updates`, `wilks`) and ~50 spec files whose ticked tasks have no `→ path:symbol` back-link.

Approach: do this incrementally — each time a feature is touched, link its files and back-annotate its spec tasks as part of the normal wrap-up. No big-bang rewrite. When coverage reaches ~100%, flip `npm run check:spec-links` from advisory to `--strict` in `/verify`. Engine code under `packages/training-engine/src/` should follow the same convention.

## 25

**Mobile pose-detection gets 0 valid frames on videos where dashboard gets reps.** Observed 2026-04-19 on a ~14s squat clip: `[pose] 0/38 valid frames (0%)` from the mobile pipeline; the same video loaded in the dashboard (`apps/dashboard/src/app/VideoOverlayPreview.tsx` → `browser-pose-extractor.ts`) produces real landmarks and rep analysis. Mobile reanalyze completes end-to-end (see #20) but the upstream signal is empty — everything downstream is correct-but-useless.

### Diagnostic landed (2026-04-19)

`extractFramesFromVideo` now emits a structured one-line `__DEV__` log on every analysis:
`[pose] X/Y valid frames (Z%) thumb=WxH (aspect=A) reject=N noResult+T trunc+E err firstValidVis=V`. This separates the four failure modes that previously all collapsed into "valid=0":

- `thumb=WxH` — thumbnail dimensions. If `aspect > 1` on a portrait recording, hypothesis #1 (rotation) is confirmed.
- `noResult` — MediaPipe ran but the pose didn't pass the 0.5 confidence gates. High → model/orientation issue.
- `trunc` — fewer than 33 landmarks returned. Should always be 0; non-zero indicates an upstream API change.
- `err` — `PoseDetectionOnImage` threw. Captured to Sentry already; counter just makes the rate visible alongside the rest.
- `firstValidVis` — mean visibility on the 12 powerlifting-relevant landmarks of the first frame that *did* detect. If this is < 0.3, the lifter is being detected but at a confidence the plausibility filter will reject downstream.

### Next step (waiting on device run)

Reanalyze the failing 14s squat clip with the new diagnostic, then act per branch:

Five concrete divergences between the two extraction paths, ranked by suspected impact:

1. **Thumbnail orientation** — `expo-video-thumbnails.getThumbnailAsync` may emit a thumbnail that ignores the video's rotation metadata, so portrait recordings land sideways and MediaPipe can't find a pose. Dashboard reads the `<video>` element which honours rotation via the decoder. Test: save one of the thumbnails mobile hands to MediaPipe and `adb pull` it.
2. **fps**: mobile 4 vs dashboard 30 (default). 7.5× fewer detection chances — any clip where pose is only visible in a subset of frames loses coverage.
3. **Model size**: mobile pinned to `pose_landmarker_lite.task` (5.6MB) due to device memory limits; dashboard lets you pick full (9MB) or heavy (29MB). Lite is much more brittle on oblique angles / partial occlusions.
4. **Running mode**: mobile uses MediaPipe `IMAGE` per-frame; dashboard uses `VIDEO` with temporal tracking, which recovers flaky frames via continuity.
5. **Delegate**: mobile forced to CPU (GPU SIGSEGVs on Android MediaPipe's GL runner); dashboard defaults GPU. Shouldn't affect accuracy, only speed — but worth excluding.

Direction: start with (1). If `adb pull`-ed thumbnails are rotated wrong, pipe them through `expo-image-manipulator.rotate` (or bypass thumbnails entirely — `react-native-mediapipe` has a video-file extractor that skips the thumbnail step). Then revisit fps: 8fps is probably safe; 15fps on a 15s clip is 225 frames, likely fine with lite model. Validate: the same squat clip that currently returns `0/38 valid` must return ≥80% valid frames and non-zero reps. Write a device-side log harness or add a "debug landmarks pull" dashboard action for easy A/B.

### Follow-up implementation paths (gated on diagnostic)

1. **If `thumb=` aspect is wrong** (most likely): native fix needed. `expo-video-thumbnails` calls Android's `MediaMetadataRetriever.getFrameAtTime()` which returns frames in the encoded orientation, not the displayed orientation — vendor-dependent across devices. Two options:
   - Patch `expo-video-thumbnails` (or fork) to read `METADATA_KEY_VIDEO_ROTATION` and rotate the bitmap before writing the JPEG.
   - Add a tiny native helper exposing rotation to JS, then add `expo-image-manipulator` (new dep, requires fresh dev build) and rotate each thumbnail in the loop. More invasive but doesn't touch a third-party module.
2. **If `noResult` is high but `thumb=` aspect looks right**: bump `targetFps` cautiously (4 → 6, then re-check 60-frame stability ceiling). Consider per-clip switch to `pose_landmarker_full.task` for confirmed-failed clips, gated on memory headroom.
3. **If `firstValidVis < 0.3` consistently**: detection is happening but at very low confidence — likely lighting / framing. Lower the per-frame confidence floor in the assembler instead of changing extraction.

`react-native-mediapipe` does **not** expose a video-file extractor (only `PoseDetectionOnImage` for paths and `usePoseDetection` for live camera frames) — original backlog mention was optimistic. Path-based extraction stays.

