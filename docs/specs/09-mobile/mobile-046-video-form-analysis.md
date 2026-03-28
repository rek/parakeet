# mobile-046: Video Form Analysis — Phase 1

**Design:** [video-form-analysis.md](../../design/video-form-analysis.md)
**Issue:** GH#148

## Phase 1: Infrastructure + video pick + analysis pipeline

Core pipeline: pick video → compress → run MediaPipe → extract bar path + joint angles → detect reps → calculate metrics → display.

### 1.1 — Native dependencies + Expo config

- [ ] Install `react-native-vision-camera`, mediapipe pose plugin, `expo-image-picker`, `react-native-compressor`
- [ ] Add camera permission to `app.json` plugins
- [ ] Verify `npx expo prebuild` + EAS dev build works
- [ ] Test MediaPipe pose detection on a sample video (proof of concept)

### 1.2 — Database + data model

- [ ] Migration: `session_videos` table (id, user_id, session_id, lift, local_uri, remote_uri, duration_sec, analysis JSONB, created_at) with RLS
- [ ] Update `supabase/types.ts`
- [ ] Zod schema for `VideoAnalysisResult` in `shared-types` (reps array, fps, cameraAngle, analysisVersion)
- [ ] Types: `BarPathPoint`, `RepAnalysis`, `FormFault`

### 1.3 — Module scaffold + feature flag

- [ ] Create `modules/video-analysis/` with canonical structure (ui/, hooks/, application/, data/, lib/, model/, index.ts)
- [ ] Add `videoAnalysis` feature flag to registry (Advanced category, default off)
- [ ] `video.repository.ts`: insertVideo, getVideoForSessionLift, getVideosForLift, deleteVideo
- [ ] Local file management: save compressed video to app documents dir, clean up on delete

### 1.4 — Analysis pipeline (pure logic in lib/)

- [ ] `pose-processor.ts`: accept MediaPipe pose landmarks per frame → normalize coordinates
- [ ] `bar-path.ts`: extract bar position from averaged wrist landmarks per frame, smooth with moving average
- [ ] `rep-detector.ts`: peak detection on hip/wrist Y-coordinate → rep boundaries (start/end frame per rep)
- [ ] `angle-calculator.ts`: compute joint angles from 3-point landmarks (hip-knee-ankle, shoulder-hip-knee, etc.)
- [ ] `fault-detector.ts`: per-lift form fault detection using fixed thresholds (see design doc table)
- [ ] `metrics-assembler.ts`: combine bar path + angles + faults → `VideoAnalysisResult` per rep
- [ ] Tests for each pure function (rep detection, angle math, fault thresholds)

### 1.5 — Analysis orchestration (application/)

- [ ] `analyze-video.ts`: orchestrator — receives video URI → extract frames → run MediaPipe per frame → pipe through lib/ functions → return `VideoAnalysisResult`
- [ ] Handle MediaPipe initialization and cleanup
- [ ] Progress callback for UI (% frames processed)

### 1.6 — Video pick + compress hook

- [ ] `useVideoAnalysis` hook: pick video (expo-image-picker) → compress (react-native-compressor) → run analysis → save to repository → return result
- [ ] Loading state, error handling, progress percentage

### 1.7 — UI: entry points

- [ ] Session screen (`[sessionId].tsx`): camera icon on main lift header + aux exercise headers (gated by feature flag)
- [ ] History detail (`history/[sessionId].tsx`): "Add Video" / "View Analysis" button per lift section (gated by feature flag)
- [ ] Both entry points navigate to analysis screen with `sessionId + lift` params

### 1.8 — UI: analysis screen

- [ ] `session/video-analysis.tsx` (or bottom sheet)
- [ ] Video player with bar path overlay drawn on top (SVG or Canvas)
- [ ] Bar path colored: green (straight), yellow (moderate drift), red (significant drift)
- [ ] Rep timeline below video: tappable segments showing rep boundaries
- [ ] Rep metrics cards: per-rep depth, lean angle, bar drift, ROM, faults
- [ ] Training context header: lift, weight, RPE, block/week from session data
- [ ] Fault badges: visual indicators for detected issues

## Phase 2: LLM coaching + longitudinal tracking (future)

- [ ] LLM coaching: feed metrics + training context to `generateText()` for natural language feedback
- [ ] Personal baselines: after 5+ videos per lift, compute lifter's typical angles/path → detect deviations from personal pattern
- [ ] Longitudinal comparison: side-by-side or overlay of bar paths across sessions
- [ ] Front view support: optional second video for knee valgus detection
- [ ] Real-time overlay: live pose estimation during recording via vision-camera frame processor
- [ ] Cloud backup: Supabase Storage upload, remote_uri populated
- [ ] In-app recording with tripod guide overlay
