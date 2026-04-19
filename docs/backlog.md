# Backlog

If you are a human, say to an Agent: **"Read docs/backlog.md and do item N"**

If you are an AI Agent, first read: `docs/README.md` and understand our intent and architecture.

Then always make sure to follow the [AI Workflow](./guide/ai-workflow.md) (orient → design → plan → implement → validate → wrap up).

At the end: update design doc status → Implemented, update specs to match what was actually built, update `docs/features/<feature>/index.md`, then review and add any learnings to `docs/guide/ai-workflow.md`.

---

## 24 (Track A only — front-bench occlusion robustness)

Track B (front-on metrics) shipped 2026-04-19 as analysisVersion 5 — see [spec-metrics.md §Phase 6](features/video-analysis/spec-metrics.md#phase-6--front-on-bench-v5-2026-04-19--backlog-24-track-b). Rep detection now uses `(meanWristY − meanShoulderY)` below 0.5 sagittal confidence; bar tilt, press asymmetry, elbow-path symmetry, and a per-frame elbow-flare series emit on `bench-front-4reps`.

**Track A remains open.** At chest touch the bar+forearms occlude the lifter's face. MediaPipe Pose Landmarker relies on the face region as an anchor for whole-body pose, so occlusion collapses face confidence and the estimator cascades — torso and hip landmarks drift toward background features (bench frame, ceiling lights) until the face comes back post-lockout. The skeleton visibly detaches from the body at the bottom of each rep then snaps back near lockout. Downstream metrics we just shipped in §Phase 6 still consume whatever landmarks MediaPipe emits, so Track A multiplies their accuracy.

Avenues, rough order of bang-for-buck:

1. **Heavy model** — `pose_landmarker_heavy.task` (29MB) is dramatically more robust to face occlusion than `lite` (5.6MB). Dashboard already offers it as a picker option; confirm with `bench-front-4reps` fixture whether heavy closes the gap. If it does, the mobile story shifts from "never use heavy" to "download on-demand for bench".
2. ~~**Plausibility filtering**~~ — **shipped 2026-04-19** as Stage 1a of the analysis pipeline (`lib/plausibility-filter.ts`). Rejects frames where the median visibility across 12 core landmarks drops below 0.3, or where the shoulder-midpoint jumps > 8× the clip's own median (with a 0.08-unit absolute floor). Rejected frames become `EMPTY_FRAME` and are lerped through by Stage 1b. 16/16 calibration fixtures still pass at the new thresholds. Returns `lowVisibilityRejected` / `torsoJumpRejected` counts for future dashboard surfacing.
3. ~~**Wrist-anchored reconstruction for bench**~~ — **shipped 2026-04-19** as Stage 1a' (`lib/wrist-anchored-reconstruct.ts`). For each Stage-1a rejection whose *original* wrists are still visible, rebuild from the nearest confident anchor: shoulders/hips/knees/ankles held at anchor values, wrists taken verbatim, elbows placed at shoulder→wrist midpoint. Reconstructed-landmark visibility floored at `VIS_THRESHOLD = 0.5` so per-landmark gates don't silently fail. Bench-only (rigid-arm approximation assumes supine lifter).
4. **World-coords fallback** — MediaPipe emits `worldLandmarks` (3D, temporally stabilised) alongside image-coords. We currently consume only image-coords. World-coords may survive occlusion better; worth trialling at least in the dashboard path where the field is readily available.
5. **Pre-crop the lifter** — run face detection on frame 0, dilate to a lifter bbox, and crop subsequent frames before passing to MediaPipe. Strips out the bench frame + ceiling context that's currently pulling the skeleton away. Cost: one extra detector pass, negligible on desktop.

### Validation

- Calibration fixture: `test-videos/bench-front-4reps.landmarks.json`. Re-run after each Track A change; rep count must stay at 4 and confidence should improve (currently 0.356).
- Dashboard: add a visible "plausibility rejection" counter so we can eyeball how many frames each filter strips.

### Out of scope

- Mobile pipeline's 0-valid-frames problem (that's #25).

## 23

**Back-annotate `@spec` headers across all modules + spec back-links.** Convention + checker shipped 2026-04-19 (see [docs/guide/spec-linking.md](./guide/spec-linking.md) and `tools/scripts/check-spec-links.mjs`). Pilot done on `modules/video-analysis` (3 files + 2 spec tasks). Remaining: 19 unlinked modules (`achievements`, `auth`, `body-review`, `cycle-review`, `cycle-tracking`, `disruptions`, `feature-flags`, `formula`, `gym-partners`, `history`, `jit`, `onboarding`, `profile`, `program`, `session`, `settings`, `training-volume`, `updates`, `wilks`) and ~50 spec files whose ticked tasks have no `→ path:symbol` back-link.

Approach: do this incrementally — each time a feature is touched, link its files and back-annotate its spec tasks as part of the normal wrap-up. No big-bang rewrite. When coverage reaches ~100%, flip `npm run check:spec-links` from advisory to `--strict` in `/verify`. Engine code under `packages/training-engine/src/` should follow the same convention.

## 25

**Mobile pose-detection gets 0 valid frames on videos where dashboard gets reps.** Observed 2026-04-19 on a ~14s squat clip: `[pose] 0/38 valid frames (0%)` from the mobile pipeline; the same video loaded in the dashboard (`apps/dashboard/src/app/VideoOverlayPreview.tsx` → `browser-pose-extractor.ts`) produces real landmarks and rep analysis. Mobile reanalyze completes end-to-end (see #20) but the upstream signal is empty — everything downstream is correct-but-useless.

Five concrete divergences between the two extraction paths, ranked by suspected impact:

1. **Thumbnail orientation** — `expo-video-thumbnails.getThumbnailAsync` may emit a thumbnail that ignores the video's rotation metadata, so portrait recordings land sideways and MediaPipe can't find a pose. Dashboard reads the `<video>` element which honours rotation via the decoder. Test: save one of the thumbnails mobile hands to MediaPipe and `adb pull` it.
2. **fps**: mobile 4 vs dashboard 30 (default). 7.5× fewer detection chances — any clip where pose is only visible in a subset of frames loses coverage.
3. **Model size**: mobile pinned to `pose_landmarker_lite.task` (5.6MB) due to device memory limits; dashboard lets you pick full (9MB) or heavy (29MB). Lite is much more brittle on oblique angles / partial occlusions.
4. **Running mode**: mobile uses MediaPipe `IMAGE` per-frame; dashboard uses `VIDEO` with temporal tracking, which recovers flaky frames via continuity.
5. **Delegate**: mobile forced to CPU (GPU SIGSEGVs on Android MediaPipe's GL runner); dashboard defaults GPU. Shouldn't affect accuracy, only speed — but worth excluding.

Direction: start with (1). If `adb pull`-ed thumbnails are rotated wrong, pipe them through `expo-image-manipulator.rotate` (or bypass thumbnails entirely — `react-native-mediapipe` has a video-file extractor that skips the thumbnail step). Then revisit fps: 8fps is probably safe; 15fps on a 15s clip is 225 frames, likely fine with lite model. Validate: the same squat clip that currently returns `0/38 valid` must return ≥80% valid frames and non-zero reps. Write a device-side log harness or add a "debug landmarks pull" dashboard action for easy A/B.

## ~~21~~ (Done — 19 Apr 2026)

Pose-geometry classifier (`lib/detect-lift.ts`) runs after frame extraction in `processVideo` and `reanalyzeSessionVideo`. Signal: `(wristY − shoulderY) / torsoLen`. Bench median ≤ -0.1, deadlift p90 ≥ 1.0 or median ≥ 0.4, else squat. Abstains below 8 usable frames; confidence saturates only above 20 frames. `WARN_CONFIDENCE = 0.75` gates the user-facing Alert so borderline clips stay silent. On confident mismatch, non-blocking Alert *"This looks like a X — you labelled it Y."* fires after the row is saved, with `OK, will fix` / `Continue anyway` buttons. Analysis always runs. Sentry breadcrumb on each mismatch. 16/16 fixtures classify correctly-or-silently. See [spec-lift-label.md](features/video-analysis/spec-lift-label.md).

In-place relabel button deferred — would need to rewrite `session_videos.lift`, purge prior coaching, and re-run `analyzeVideoFrames`. File as follow-up when needed.

## ~~19~~ (Done — 19 Apr 2026)

Playback overlays complete. Phase 1 bar-path overlay shipped earlier; Phase 2 skeleton overlay landed today — `ui/PlaybackSkeletonOverlay.tsx` lerps between sparse 3–4 fps landmarks to draw bones at the native video's display rect under `contentFit="contain"` letterboxing. `debug_landmarks` promoted out of the `__DEV__` guard in both `processVideo` and `reanalyze`; repository validates the stored JSON with a new `DebugLandmarksSchema` (Zod) before surfacing it on `SessionVideo.debugLandmarks`. Skeleton toggle chip flips from "No landmarks for this video" to interactive the moment a row has a populated payload. Old videos get skeletons by tapping Re-analyze (backlog #20). Phase 3 backfill deferred per spec. See [design doc](features/video-analysis/design-playback-overlay.md) and [spec](features/video-analysis/spec-playback-overlay.md).

## 17

**Local-only video storage — drop Supabase Storage uploads.** Raw `.mp4` bytes do not need to live in the cloud; only analysis results (metrics, coaching, landmarks) do. Triggered by a 0-byte upload bug on 2026-04-17 (expo-file-system's `File` class does not correctly implement `Blob`, so `supabase.storage.upload(path, file, …)` wrote empty objects silently). Patched in-place, but the incident exposed that the upload path is fragile and low-value. Gym-partner flow is the one open question — likely resolved by sending only partner-computed analysis, not video bytes. See [design doc](features/video-analysis/design-local-only-storage.md).

## 16 (Set-durability column drop — pending coordinated deploy)

Feature shipped 2026-04-18. Remaining work: coordinated DB/client deploy to drop `session_logs.actual_sets` / `auxiliary_sets` JSONB columns. Sequence documented at [`tools/scripts/pending-drop-session-logs-jsonb.md`](../tools/scripts/pending-drop-session-logs-jsonb.md). Also update `tools/scripts/import-csv.ts` to write `set_logs` before the JSONB columns drop.

## 9

4-day programs with overhead press as a first-class primary lift. See [design doc](features/ohp/design.md) and [feature index](features/ohp/index.md). ~30 files, 8 specs.
