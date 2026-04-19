# mobile-046: Video Form Analysis

**Design:** [video-form-analysis.md](./design-form-analysis.md)
**Issue:** GH#148

## Phase 1: Infrastructure + video pick + analysis pipeline

Core pipeline: pick video → compress → save locally + DB. Pure analysis pipeline ready for real pose data.

### 1.1 — Native dependencies + Expo config

- [x] Install `expo-image-picker`, `react-native-compressor`
- [x] Add photo/camera permissions to `app.json` plugins
- [x] Verify `npx expo prebuild` + EAS dev build works

### 1.2 — Database + data model

- [x] Migration: `session_videos` table (id, user_id, session_id, lift, local_uri, remote_uri, duration_sec, analysis JSONB, created_at) with RLS
- [x] Update `supabase/types.ts`
- [x] Zod schema for `VideoAnalysisResult` in `shared-types` (reps array, fps, sagittalConfidence, analysisVersion)
- [x] Types: `BarPathPoint`, `RepAnalysis`, `FormFault`

### 1.3 — Module scaffold + feature flag

- [x] Create `modules/video-analysis/` with canonical structure (ui/, hooks/, application/, data/, lib/, model/, index.ts)
- [x] Add `videoAnalysis` feature flag to registry (Advanced category, default off)
- [x] `video.repository.ts`: insertVideo, getVideoForSessionLift, getVideosForLift, deleteVideo
- [x] Local file management: save compressed video to app documents dir

### 1.4 — Analysis pipeline (pure logic in lib/)

- [x] `bar-path.ts`: extract bar position from averaged wrist landmarks per frame, smooth with moving average
- [x] `rep-detector.ts`: rep boundaries (start/end frame per rep). Squat + bench use peak detection on a joint-angle signal (see [spec-view-angle.md](./spec-view-angle.md)). Deadlift uses a dedicated hip-angle FLOOR→LOCKOUT state machine with spike-filter + sustain-hold (updated 2026-04-18, backlog #18) — peak detection double-counts on the inverted hip signal.
- [x] `angle-calculator.ts`: compute joint angles from 3-point landmarks (hip-knee-ankle, shoulder-hip-knee, etc.)
- [x] `depth-detector.ts`: squat depth detection from hip-crease vs knee Y
- [x] `fault-detector.ts`: per-lift form fault detection using fixed thresholds (see design doc table)
- [x] `metrics-assembler.ts`: combine bar path + angles + faults → `VideoAnalysisResult` per rep
- [x] Tests: 81 Vitest tests passing (bar path, rep detection, angle math, depth, fault thresholds, metrics assembly)

### 1.5 — Analysis orchestration (application/)

- [x] `analyze-video.ts`: `analyzeVideoFrames()` — receives pose frames → pipes through lib/ functions → returns `VideoAnalysisResult`

#### Pipeline stages (updated 2026-04-19)

Analysis is a five-stage pipeline. Stages are explicit — each one's output is a named input to the next, so a future change (front-on bench pipeline, lift-driven strategy selection) drops in at a clean seam instead of bolted inside `assembleAnalysis`.

| Stage | Runs in | Responsibility | Consumes | Emits |
| --- | --- | --- | --- | --- |
| 0 — Lift label | `hooks/useVideoAnalysis.ts`, `application/reanalyze.ts` | Check the user's declared lift against the pose with `checkLiftMismatch`; surface a user-facing nudge if it looks wrong. Analysis still runs regardless — this is a nudge, not a gate (see [spec-lift-label.md](./spec-lift-label.md)). | `frames`, `declared` lift | `LiftMismatch \| null` → Alert |
| 1a — Plausibility | `application/analyze-frames.ts` → `lib/plausibility-filter.ts` | Reject frames where the pose has likely collapsed to background features. Two checks: median visibility across the 12 pose-critical landmarks below 0.3, or shoulder-midpoint jump > 8× the clip's median jump (with a 0.08-unit absolute floor). Rejected frames become `EMPTY_FRAME` so Stage 1b lerps them away. Motivated by the bar-over-face occlusion on front-on bench (backlog #24 Track A). | `frames` | `frames` (with outliers zeroed), `lowVisibilityRejected`, `torsoJumpRejected` counts |
| 1b — Frame hygiene | `application/analyze-frames.ts` | Lerp empty-landmark frames from neighbours so failed detections don't corrupt bar path, angles, or rep detection with zero coords. | `frames` from 1a | interpolated `frames[]`, `effectiveFps` |
| 2 — Sagittal confidence | `application/analyze-frames.ts` | Measure shoulder/hip X-separation across the clip → scalar `0–1` for how side-on the camera is. Downstream metrics are foreshortened at oblique angles; this lets the metric layer compensate instead of branching on a binary side/front flag. | interpolated `frames` | `sagittalConfidence: number` |
| 3 — Deep analysis | `lib/metrics-assembler.ts` (`assembleAnalysis`) | Bar path, rep boundaries, per-rep metrics, faults, grading. `sagittalConfidence` is an **input**, not a side-computation — so fixtures and calibration runs can override it, and the stage is pure given a known confidence. | `frames`, `fps`, `lift`, `sagittalConfidence`, optional `strategy` | `VideoAnalysisResult` |

Stage 0 lives at the hook/orchestrator layer (not inside `analyzeVideoFrames`) because the mismatch drives an Alert — surfacing it requires the hook's return channel. Stages 1a–3 are pure and are called together via `analyzeVideoFrames`, which is the public entry point from both the mobile hook and the dashboard calibration tool.

### 1.6 — Video pick + compress hook

- [x] `useVideoAnalysis` hook: pick video (expo-image-picker) → compress (react-native-compressor) → save to repository → return result
- [x] Loading state, error handling, progress percentage

### 1.7 — UI: entry points

- [x] `VideoEntryButton` — self-contained, feature-flagged camera icon for session/history screens
- [x] Both entry points navigate to analysis screen with `sessionId + lift` params

> **Note (mobile-051):** The header-level `VideoEntryButton` (icon variant) is removed from the active session screen. The `link` variant remains on the history detail screen for retrospective adds. The primary in-session recording entry point is now PostRestOverlay — see [mobile-051](./mobile-051-post-rest-recording.md).

### 1.8 — UI: analysis screen

- [x] `session/video-analysis.tsx` — video section + analysis section
- [x] Bar path overlays (SVG) — one per rep, colored by drift
- [x] Rep metrics cards: per-rep depth, lean angle, bar drift, ROM, faults
- [x] Fault badges: visual indicators for detected issues
- [x] Progress bar during processing

## Phase 2: MediaPipe pose estimation + video playback

On-device pose estimation via MediaPipe, replacing the Phase 1 placeholder.

### 2.1 — Native dependencies + config

- [x] Install `react-native-mediapipe@0.6.0`, `react-native-vision-camera@4.7.3`, `react-native-worklets-core@1.6.3`
- [x] Install `expo-video-thumbnails@~55.0.11` (frame extraction), `expo-video@~55.0.11` (playback)
- [x] Add `react-native-worklets-core/plugin` to `.babelrc.js`
- [x] Add `react-native-vision-camera` config plugin to `app.json` (camera permission)
- [x] Add deps to both root + app `package.json` (autolinking)

### 2.2 — MediaPipe model bundling

- [x] Bundle `pose_landmarker_lite.task` (~5.6MB) to `assets/models/`
- [x] Create `plugins/with-mediapipe-model.js` Expo config plugin to copy model to Android `assets/` during prebuild
- [x] Add plugin to `app.json`

> Why **lite, not full/heavy**: the full (9MB) and heavy (29MB) variants blow past Android memory budgets on constrained devices and OOM-kill the extraction loop. Lite + per-frame bitmap cleanup + `yieldToGc` between frames is the only combination that stayed stable at 60 frames in testing. The dashboard-side calibration tool (`apps/dashboard/src/app/VideoOverlayPreview.tsx`) lets you run full/heavy for comparison, but the mobile app will stay on lite until we have a memory budget to spare.

### 2.3 — Frame extraction + pose detection

- [x] Implement `extractFramesFromVideo()` in `application/analyze-video.ts`:
  - Compute frame timestamps at `targetFps` intervals (default **4fps** — tuned to 8–16 samples per rep given 2–4s rep duration, stays within device memory)
  - Extract frame images via `expo-video-thumbnails.getThumbnailAsync(videoUri, { time, quality: 0.8 })`
  - Run `PoseDetectionOnImage()` per frame → 33 landmarks, **`Delegate.CPU`** (GPU delegate triggers SIGSEGV in MediaPipe's GL runner on several Android devices)
  - Delete thumbnail file + yield to event loop between frames (native GC reclaims bitmaps — prevents OOM)
  - Convert MediaPipe `Landmark` → `PoseLandmark` (x, y, z, visibility)
  - Progress callback for UI
  - Empty landmark frames for missing pose detections (maintains index alignment; `analyze-frames.ts` lerps them back in later)

#### Two extraction pipelines

The same `analyzeVideoFrames()` core runs on landmarks from two very different upstream pipelines. They share only the `PoseFrame[]` shape — the extraction knobs and performance profiles differ substantially, and when rep counts diverge between the two, the difference is always upstream of `analyzeVideoFrames`.

| Concern | Mobile (in-app) | Dashboard (calibration) |
| --- | --- | --- |
| Entry | `application/analyze-video.ts` → `extractFramesFromVideo` | `apps/dashboard/src/lib/browser-pose-extractor.ts` → `extractLandmarksFromVideo` |
| MediaPipe API | `react-native-mediapipe` `PoseDetectionOnImage` (IMAGE mode) | `@mediapipe/tasks-vision` `PoseLandmarker.detectForVideo` (VIDEO mode, temporal tracking) |
| Frame source | `expo-video-thumbnails` JPEG (`quality: 0.8`) | `HTMLVideoElement` frame, read directly by the landmarker |
| fps | 4 (hard-coded `DEFAULT_TARGET_FPS`) | 10 / 15 / 24 / 30 / 60 (user picker, default 30) |
| Model | `pose_landmarker_lite.task` (5.6MB) — bundled | lite (5.6MB) / full (9MB) / heavy (29MB) — fetched from CDN |
| Delegate | `CPU` (forced; see note above) | `GPU` (WebGL2); auto-falls back to `CPU` if init fails |
| Memory posture | Delete thumbnail + `await yieldToGc()` per frame, 60-frame safety limit | No per-frame cleanup needed; browser handles lifetime |
| Offline? | Yes (model bundled) | No (model + WASM fetched from jsdelivr / googleapis) |

This divergence matters when investigating pose-detection quality: if the mobile path reports `0/N valid frames` on a clip the dashboard analyses successfully, suspect the extraction layer (thumbnail orientation, JPEG loss, IMAGE-mode missing temporal tracking, or fps under-sampling) before suspecting the analysis pipeline. See backlog #25 for an active investigation.

### 2.4 — Hook wiring

- [x] Wire `extractFramesFromVideo()` → `analyzeVideoFrames()` in `useVideoAnalysis` hook
  → `modules/video-analysis/application/analyze-video.ts:extractFramesFromVideo`
  → `modules/video-analysis/application/analyze-frames.ts:analyzeVideoFrames`
  → `modules/video-analysis/hooks/useVideoAnalysis.ts`
- [x] Analyze BEFORE compression (better quality for CV)
- [x] Graceful fallback when MediaPipe unavailable (logs error, saves video without analysis)
- [x] Add `updateSessionVideoAnalysis()` to repository — saves analysis JSONB after initial insert

### 2.5 — Video playback

- [x] `VideoPlayerCard` component using `expo-video` `VideoView` + `useVideoPlayer`
- [x] Native playback controls, 16:9 aspect ratio, replace button
- [x] Replace placeholder card in analysis screen

## Phase 3: LLM coaching + longitudinal tracking + advanced recording

### 3.1 — Session context bridge

- [x] `assemble-coaching-context.ts`: assembles video analysis metrics + session data (weight, RPE, soreness, block/week, disruptions) + longitudinal averages from previous videos into a single coaching context object
  → `modules/video-analysis/application/assemble-coaching-context.ts`

### 3.2 — LLM coaching engine

- [x] `FormCoachingResultSchema` in shared-types: summary, rep-by-rep breakdown, coaching cues with priorities, fatigue correlation, baseline comparison, next-session suggestion
- [x] `FORM_COACHING_SYSTEM_PROMPT` in training-engine: powerlifting-specific form coaching prompt with rep-by-rep analysis, fatigue correlation, and actionable cues
- [x] `generateFormCoaching()` in training-engine: gpt-5 structured output generator

### 3.3 — LLM coaching hook + UI + DB

- [x] Migration: `coaching_response` JSONB column on `session_videos`
- [x] `updateSessionVideoCoaching()` repository function
- [x] `useFormCoaching` hook: fetches session context → assembles coaching context → calls LLM → persists result
- [x] `FormCoachingCard` component: generate button, loading state, summary, rep-by-rep grades, coaching cues with priority colors, fatigue correlation, baseline comparison, next-session suggestion

### 3.4 — Personal baselines

- [x] `computePersonalBaseline()`: mean + standard deviation of bar drift, forward lean, ROM, depth, knee angle, hip lockout across 5+ videos
- [x] `detectBaselineDeviations()`: z-score detection (>1.5 SD) with direction (better/worse) per metric
- [x] `BaselineDeviationBadge` component: colored badge showing deviation vs baseline
- [x] 11 tests (baseline computation + deviation detection)

### 3.5 — Longitudinal comparison

- [x] `LongitudinalComparison` component: overlaid bar paths from previous sessions (SVG), color-coded by recency, trend table with drift/lean/ROM across dates
- [x] `usePreviousVideos` hook: fetches all historical videos for a lift

### 3.6 — Cloud backup (scaffolded, upload deferred)

- [x] Migration: Supabase Storage bucket `session-videos` with RLS policies
- [x] `uploadVideoToStorage()` function: uploads compressed video, updates `remote_uri`
- [ ] Wire auto-upload into hook (deferred — TODO in useVideoAnalysis)

### 3.7 — Front view support

- [x] ~~Migration: `camera_angle` column on `session_videos`~~ → replaced by `sagittal_confidence real NOT NULL DEFAULT 0.8`
- [x] `computeKneeValgus()`: frontal plane hip-knee-ankle angle + medial detection
- [x] ~~Repository: `insertSessionVideo` accepts `cameraAngle` parameter~~ → accepts `sagittalConfidence: number`
- [x] ~~Model: `SessionVideo.cameraAngle` field~~ → `SessionVideo.sagittalConfidence: number`

> **Superseded (mobile-052):** Binary `'side' | 'front'` classification replaced by continuous `sagittalConfidence` (0–1). `camera_angle` column dropped. All metrics always computed with confidence weighting. See [mobile-052](./mobile-052-view-angle-rework.md).

### 3.8 — In-app recording (CameraAnglePicker removed in mobile-052)

- [x] `RecordVideoSheet` component: vision-camera recording with guide overlay (side/front silhouette, positioning hints, record/stop controls, permission handling)

### 3.9 — Real-time pose overlay

- [x] `useLivePoseOverlay` hook: `usePoseDetection` with `LIVE_STREAM` mode at 15fps (GPU delegate OK here — vision-camera's frame processor uses a separate MediaPipe entry point that doesn't hit the SIGSEGV path the IMAGE extractor does)
- [x] `LiveSkeletonOverlay` component: draws skeleton lines + landmark dots over camera preview
- [x] `SKELETON_CONNECTIONS` constant: 12 bone connections for powerlifting-relevant skeleton

## Adjacent concepts (not phases, but worth knowing)

- **Strategy swap point** — `lib/analysis-strategy.ts` defines a `STRATEGIES` map keyed by strategy name (default `v1_mediapipe`). `assembleAnalysis` accepts a `strategy` argument, so alternative bar-path / rep-detection / fault / grader implementations can be A/B'd without forking. Used by the dashboard's experimental "strategy picker" (planned) and by calibration scripts when comparing detector versions.
- **Perspective correction** — `metrics-assembler.ts perspectiveCorrection()` divides foreshortened scalar metrics (depth, forward lean) by `sqrt(sagittalConfidence)` when confidence < 0.8, so oblique-angle videos don't under-report. At pure side (confidence=1.0) the multiplier is 1.0; at 0.1 confidence it caps amplification.
- **Debug landmarks** — `session_videos.debug_landmarks` is a dev-only JSONB snapshot of the raw `PoseFrame[]` the detector saw. Written by `updateSessionVideoDebugLandmarks` when `__DEV__` is true; never written in release builds. Consumed by `scripts/pull-device-analysis.ts` (copy device landmarks → calibration fixtures) and by the reanalyze regression test.
- **Readiness score** — `lib/readiness-score.ts computeReadinessFromVerdicts` turns a rolling window of per-rep `RepVerdict`s (IPF pass/borderline/fail) into a 0–100 competition-readiness number. Surfaced on the analysis screen via `ReadinessCard` once at least one analysed video exists.
- **Personal baseline & deviations** — `lib/personal-baseline.ts` needs `MIN_VIDEOS_FOR_BASELINE` (5) analyses of the same lift to compute per-metric mean/stdev. `detectBaselineDeviations` z-scores the current rep against that baseline and emits `BaselineDeviation` badges. This is *separate* from fatigue signatures (which compare first-vs-last rep *within* a set).

## Reanalyze

See [spec-reanalyze.md](./spec-reanalyze.md).

> **Note (mobile-051):** `RecordVideoSheet` is also used from PostRestOverlay via the slot pattern (`PostRestRecordButton`), not only from the video-analysis screen. See [mobile-051](./mobile-051-post-rest-recording.md).
