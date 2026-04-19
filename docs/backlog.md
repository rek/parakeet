# Backlog

If you are a human, say to an Agent: **"Read docs/backlog.md and do item N"**

If you are an AI Agent, first read: `docs/README.md` and understand our intent and architecture.

Then always make sure to follow the [AI Workflow](./guide/ai-workflow.md) (orient → design → plan → implement → validate → wrap up).

At the end: update design doc status → Implemented, update specs to match what was actually built, update `docs/features/<feature>/index.md`, then review and add any learnings to `docs/guide/ai-workflow.md`.

---

## 26

**Bench depth assessment — detect partial reps / no chest touch.**

### What and why

Observed 2026-04-19 while sanity-checking v5 front-bench metrics on `bench-front-4reps`: user confirmed the bar never touches the chest on any of the 4 reps. The v5 analysis still reports 4 reps and emits bench-specific faults (flare, tilt, press asymmetry, uneven lockout) but has **no metric** covering *how close the bar got to the chest*. On a competition bench this is the single most red-lightable form fault (rule: visible stop on chest); for training it's the difference between a real press and a partial.

### Prior context an agent needs

- **Analysis pipeline** is documented at [docs/features/video-analysis/spec-pipeline.md §1.5 "Pipeline stages"](features/video-analysis/spec-pipeline.md#pipeline-stages-updated-2026-04-19). Five stages: lift-label (0) → plausibility (1a) → wrist-reconstruct (1a') → interpolation (1b) → sagittal confidence (2) → deep analysis (3). This work lives in **Stage 3** — add to `lib/metrics-assembler.ts` alongside the other bench-specific metrics.
- **v5 shipped 2026-04-19** as backlog #24 Track B — see [spec-metrics.md §Phase 6](features/video-analysis/spec-metrics.md#phase-6--front-on-bench-v5-2026-04-19--backlog-24-track-b). v5 added `bar-tilt.ts`, `press-asymmetry.ts`, `elbow-path-symmetry.ts`, `elbow-flare-series.ts`. **These are the templates** to follow: pure lib modules with `computeXxx({ frames, startFrame, endFrame })` signatures, consumed inside the per-rep loop in `metrics-assembler.ts`. Bump `ANALYSIS_VERSION` to **6** for this work.
- **Threshold convention** (established §Phase 6): new constants live as `const X_FAULT_Y = …` in `metrics-assembler.ts` with a provisional-thresholds subsection in the spec explaining they're tuned on one fixture until ≥ 3 independent fixtures exist.
- **Fixture**: `test-videos/bench-front-4reps.mp4` (+ `test-videos/landmarks/bench-front-4reps.landmarks.json`). User confirmed this video has **4 reps, none of which touch chest**. Manifest: `test-videos/manifest.json` entry for `bench-front-4reps`.
- **Calibration**: `npm run calibrate:snapshots` regenerates every snapshot. Run after version bump.

### Design directions (not yet decided — do a small design pass first)

- **Front-view signal.** Bar = wrist midpoint; chest level ≈ shoulder line. At chest touch the wrists sit level with or just below shoulders → `(meanWristY − meanShoulderY) ≥ 0` at the bottom. `< 0` ⇒ wrists stopped above shoulders ⇒ partial. This is literally the same signal the v5 front-bench rep detector already oscillates on — sample its per-rep **maximum** (deepest point) rather than adding a new feature.
  - Per-rep field: `chestTouchGap` in `RepAnalysis` — how far above the shoulder line the bar stopped, in units of torso length (scale-invariant).
  - Faults: `no_chest_touch` (critical) when gap > 0.10 torso, `shallow_bench` (warning) when gap > 0.03 torso. Both emit on every rep of `bench-front-4reps` today.
- **Side-view signal.** Bar Y versus the lifter's chest Y. We don't know chest Y precisely. Two options:
  - Approximate chest ≈ `shoulderY + 0.2 * (hipY − shoulderY)` — one-fifth of the way from shoulders toward hips. Cheap and robust.
  - Skip side-view. Only gate on front view (`sagittalConfidence < MIN_SAGITTAL_CONFIDENCE`). Losing half the users' lift angles but correct is better than wrong-everywhere.
  - Recommend start: approximate chest, validate on `bench-45-5reps` (side-view fixture). If approximation is unstable, remove and gate front-only.
- **Fault severity at low confidence.** `butt_wink` pattern: severity downgrades from `warning` to `info` below `MIN_SAGITTAL_CONFIDENCE`. `no_chest_touch` should **NOT** downgrade — it's most useful from front-view where we can read it cleanly.

### Deliverables (in order)

1. Write `lib/bench-chest-touch.ts` with `computeChestTouchGap({ frames, startFrame, endFrame, sagittalConfidence }): { gap: number; framesUsed: number }`. Pure. `@spec docs/features/video-analysis/spec-metrics.md` header.
2. Unit tests `lib/__tests__/bench-chest-touch.test.ts`. Cover: clear-touch case (gap ≈ 0), clear-partial case (gap > 0.1), side-view approximation, visibility edge cases. **No tautological tests** — see [feedback_no_tautological_tests.md](../../../.claude/projects/-home-adam-dev-parakeet/memory/feedback_no_tautological_tests.md): the assertion must fail if the code being tested is removed.
3. Schema: add optional `chestTouchGap: z.number().optional()` to `RepAnalysisSchema` in `packages/shared-types/src/video-analysis.schema.ts`. Bump `ANALYSIS_VERSION` to 6 in `metrics-assembler.ts`.
4. Wire into `metrics-assembler.ts` bench block: compute per-rep using the existing `safeStart..safeEnd` window; push `no_chest_touch` / `shallow_bench` faults when thresholds trip.
5. Update `analyze-video.test.ts` version expectations (4 → 6 in `expect(result.analysisVersion).toBe(…)` calls — currently on 5).
6. Update `calibration.test.ts` version expectation (5 → 6).
7. Regenerate snapshots: `npm run calibrate:snapshots`. Verify `bench-front-4reps` emits `no_chest_touch` on every rep; side-view benches emit neither fault (or only `shallow_bench` if the approximation flags something real).
8. Update manifest `metrics_present` + `faults_to_test` for `bench-front-4reps`.
9. Write a new subsection **§Phase 7** in `spec-metrics.md` following the §Phase 6 template (what, why, lib module list, threshold table marked provisional, validation checklist).
10. Update spec-pipeline's "Pipeline stages" section if Stage 3 description needs adjustment (likely not — it's still "deep analysis" at the same layer).
11. Run `/verify` (or equivalent: `nx test parakeet` + `npm run check:boundaries`).
12. Backlog: move #26 to done with a summary of what landed.

### Not in scope

- **Touch-and-go vs paused bench.** Not distinguishing those here; the chest-touch metric only cares that the bar reached chest level, not how long it stayed.
- **Bar-Y velocity profile.** v5 already computes `pauseDurationSec` and `isSinking`. Don't duplicate.
- **Coaching prompt updates.** Adding a "mention partial rep" cue to the LLM prompt belongs to a follow-up once the metric stabilises over real-world use.
- **UI surfacing** (rep card chips for chest-touch). Follow-up.

### Starting command for a fresh agent

> Read `docs/backlog.md #26`, `docs/features/video-analysis/spec-pipeline.md`, and `docs/features/video-analysis/spec-metrics.md` §Phase 6. Follow the AI workflow (orient → design → plan → implement → validate → wrap up). When done, mark #26 done in the backlog and delete this starting-command block.

## ~~24~~ (Done — 19 Apr 2026)

**Track B** shipped as analysisVersion 5 — see [spec-metrics.md §Phase 6](features/video-analysis/spec-metrics.md#phase-6--front-on-bench-v5-2026-04-19--backlog-24-track-b). Front-bench rep detection now uses `(meanWristY − meanShoulderY)` below 0.5 sagittal confidence; bar tilt, press asymmetry, elbow-path symmetry, and a per-frame elbow-flare series all emit on `bench-front-4reps`, and the user has confirmed the flags match the lift (slight unevenness → `press_asymmetry` fires honestly).

**Track A** worked through all five avenues:

- **#1 Heavy model** — A/B'd, no material difference. Failure mode isn't model capacity.
- **#2 Plausibility filter** — shipped as Stage 1a.
- **#3 Wrist-anchored reconstruction** — shipped as Stage 1a'.
- **#4 World-coords** — A/B'd, closed for bench (body-relative axes don't align with image axes for a supine lifter filmed from the foot end). Scaffolding retained for future standing-lift use.
- **#5 Pre-crop** — deferred. The failure mode observed on `bench-front-4reps` is *not* MediaPipe snapping to background features; it's face-landmark bounce under bar occlusion (upstream, not ours) and perspective-distortion uncertainty on closest-to-camera landmarks (cropping would make worse, not better). Revisit only if a future clip shows true background-feature confusion.

**What this item produced:** five analysis-pipeline stages (0, 1a, 1a', 1b, 2, 3), dashboard tooling for fast A/B (model cache, low-confidence landmark visualisation, world-skeleton toggle), and 60+ new tests. Surfaced one real gap that didn't belong in this item — bench-chest-touch detection, filed as [#26](#26). `bench-front-4reps`: 4 reps detected at confidence 0.356, new faults fire truthfully against the user-observed lift.

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
