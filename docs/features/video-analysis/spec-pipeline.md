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
- [x] `rep-detector.ts`: peak detection on hip/wrist Y-coordinate → rep boundaries (start/end frame per rep)
- [x] `angle-calculator.ts`: compute joint angles from 3-point landmarks (hip-knee-ankle, shoulder-hip-knee, etc.)
- [x] `depth-detector.ts`: squat depth detection from hip-crease vs knee Y
- [x] `fault-detector.ts`: per-lift form fault detection using fixed thresholds (see design doc table)
- [x] `metrics-assembler.ts`: combine bar path + angles + faults → `VideoAnalysisResult` per rep
- [x] Tests: 81 Vitest tests passing (bar path, rep detection, angle math, depth, fault thresholds, metrics assembly)

### 1.5 — Analysis orchestration (application/)

- [x] `analyze-video.ts`: `analyzeVideoFrames()` — receives pose frames → pipes through lib/ functions → returns `VideoAnalysisResult`

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

- [x] Download `pose_landmarker_full.task` (~9MB) to `assets/models/`
- [x] Create `plugins/with-mediapipe-model.js` Expo config plugin to copy model to Android `assets/` during prebuild
- [x] Add plugin to `app.json`

### 2.3 — Frame extraction + pose detection

- [x] Implement `extractFramesFromVideo()` in `application/analyze-video.ts`:
  - Compute frame timestamps at `targetFps` intervals (default 15fps)
  - Extract frame images via `expo-video-thumbnails.getThumbnailAsync()`
  - Run `PoseDetectionOnImage()` per frame → 33 landmarks
  - Convert MediaPipe `Landmark` → `PoseLandmark` (x, y, z, visibility)
  - Progress callback for UI
  - Empty landmark frames for missing pose detections (maintains index alignment)

### 2.4 — Hook wiring

- [x] Wire `extractFramesFromVideo()` → `analyzeVideoFrames()` in `useVideoAnalysis` hook
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

- [x] `useLivePoseOverlay` hook: `usePoseDetection` with `LIVE_STREAM` mode at 15fps, GPU delegate
- [x] `LiveSkeletonOverlay` component: draws skeleton lines + landmark dots over camera preview
- [x] `SKELETON_CONNECTIONS` constant: 12 bone connections for powerlifting-relevant skeleton

> **Note (mobile-051):** `RecordVideoSheet` is also used from PostRestOverlay via the slot pattern (`PostRestRecordButton`), not only from the video-analysis screen. See [mobile-051](./mobile-051-post-rest-recording.md).
