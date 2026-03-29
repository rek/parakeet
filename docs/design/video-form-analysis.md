# Video Form Analysis

**Status:** Implemented (Phase 1 + 2 + 3)
**Issue:** GH#148
**Created:** 2026-03-28

## Problem

Lifters record their sets but have no way to get structured feedback within the context of their training data. Standalone bar path apps (Metric VBT, WL Analysis) analyze video in isolation — they don't know the weight, the RPE, the training block, or the soreness check-in. Parakeet has all that context but no video analysis.

## Solution

Record or import a video of a lift → on-device pose estimation extracts bar path, joint angles, and rep boundaries → display overlay + per-rep metrics → correlate with training context (weight, RPE, soreness, block phase).

## Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Processing location | On-device | Server adds 40-120s latency for upload alone. MediaPipe runs in milliseconds per frame on-device. Server logged for future reconsideration. |
| 2 | Real-time vs post-recording | Post-recording (Phase 1) | Simpler UX, no tripod-before-lift friction, lifter can't watch screen mid-squat. Real-time overlay is Phase 2. |
| 3 | Camera angle | Side view, tolerant of ~45° | Side view covers ~80% of useful metrics (bar path, depth, lean, hip hinge). MediaPipe handles off-axis angles. Phase 2 adds front view for knee valgus. |
| 4 | Supported lifts | All three (squat, bench, deadlift) | Same CV pipeline — only the interpretation layer (which angles, what thresholds) differs per lift. Lift known from session context. |
| 5 | Video source | Camera roll pick + optional in-app recording | Most lifters already film with native camera. `expo-image-picker` for MVP. In-app recording via vision-camera as a secondary option. |
| 6 | Video-to-lift association | Video belongs to a session + lift | Not per-set — too much friction. One video per lift per session. Enables longitudinal comparison ("all my squat videos"). |
| 7 | Storage | Compressed local (expo-file-system) | ~5-8MB per 30s video. Cloud backup via Supabase Storage is Phase 2. |
| 8 | Display layers | Bar path overlay → rep metrics card → LLM coaching | Layers 1+2 in Phase 1. LLM coaching (layer 3) is Phase 2 — just a `generateText()` call once metrics exist. |
| 9 | Entry points | Session screen (camera icon per lift) + history detail ("Add Video" / "View Analysis") | Shared analysis screen receives sessionId + lift as params. No new tab. |
| 10 | Rep detection | Automatic from pose landmark periodicity, manual correction available | Hip/wrist Y-coordinate traces sine wave — trough = bottom of rep. ~95% accuracy for clean reps. |
| 11 | Native dependencies | `react-native-vision-camera` + mediapipe plugin + `expo-image-picker` + `react-native-compressor` | All compatible with existing `expo-dev-client`. No TensorFlow.js (heavier, less accurate). No FFmpeg (overkill). |
| 12 | Bar path method | MediaPipe wrist landmarks averaged (left + right) | More robust than plate detection (no occlusion issues, no lighting sensitivity). ~2cm accuracy — sufficient for form coaching. |
| 13 | Form fault thresholds | Fixed evidence-based thresholds (Phase 1) → personal baselines (Phase 2) | Phase 1 uses powerlifting coaching literature. Phase 2 establishes per-lifter baselines after 5+ videos and detects deviations from personal pattern. |
| 14 | Feature flag | `videoAnalysis`, default off, Advanced category | New native deps + camera permissions. Opt-in until stable. |

## Research

### MediaPipe in React Native
- `react-native-vision-camera` is the industry standard for frame-by-frame camera access in RN
- MediaPipe Pose gives 33 body landmarks per frame, GPU accelerated, runs on-device
- Multiple RN bindings exist: `@thinksys/react-native-mediapipe`, `@gymbrosinc/react-native-mediapipe-pose`, `quickpose`
- All require `expo-dev-client` (already configured in Parakeet)
- Scientifically validated: PubMed research confirms smartphone CV barbell tracking provides data "similar to 3-D motion capture"

### Bar path from wrist landmarks
- Wrists track the bar within ~2cm during squat/bench/deadlift
- Average left + right wrist X/Y per frame = bar center
- Simple, no plate detection needed (avoids occlusion, lighting, color issues)

### Rep detection from pose periodicity
- Hip Y-coordinate (squat/deadlift) or wrist Y-coordinate (bench) traces a sine wave
- Peak detection on smoothed signal gives rep boundaries
- Established technique used by Metric VBT, RepSpeed, etc.

### Video compression
- `react-native-compressor` reduces 30s 1080p from ~80MB to ~5-8MB
- H.264 codec, configurable quality

## Data Model

### New table: `session_videos`

```sql
create table session_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  session_id uuid references sessions(id) not null,
  lift text not null,
  local_uri text not null,
  remote_uri text,
  duration_sec integer not null,
  analysis jsonb,
  created_at timestamptz default now() not null
);

alter table session_videos enable row level security;
create policy "Users can manage own videos"
  on session_videos for all using (auth.uid() = user_id);
```

### Analysis JSONB structure

```json
{
  "reps": [
    {
      "repNumber": 1,
      "startFrame": 45,
      "endFrame": 112,
      "barPath": [{ "x": 0.52, "y": 0.31, "frame": 45 }],
      "maxDepthCm": -4.2,
      "forwardLeanDeg": 38,
      "barDriftCm": 1.8,
      "romCm": 52
    }
  ],
  "fps": 30,
  "cameraAngle": "side",
  "analysisVersion": 1
}
```

## Architecture

```
modules/video-analysis/
  ui/           → VideoPlayer with bar path overlay, RepMetricsCard, FormFaultBadges
  hooks/        → useVideoAnalysis (orchestrates pick → compress → analyze → store)
  application/  → analysis pipeline: frame extraction → pose estimation → metrics
  data/         → video.repository.ts (Supabase CRUD, local file management)
  lib/          → pure math: bar path smoothing, angle calculation, rep detection, fault thresholds
  model/        → types: BarPathPoint, RepAnalysis, FormFault, VideoAnalysisResult
  index.ts      → public API
```

Engine stays untouched — all analysis logic is app-side (CV/ML is not pure domain logic).

## Form fault detection (Phase 1 thresholds)

| Fault | Lift | Detection | Threshold |
|-------|------|-----------|-----------|
| Above parallel | Squat | Hip crease Y vs knee Y at bottom | Hip Y > Knee Y |
| Excessive forward lean | Squat | Torso angle from vertical | > 55° |
| Bar drift forward | Squat/DL | Horizontal displacement from start | > 5cm |
| Back rounding | Deadlift | Shoulder-hip-knee angle change mid-pull | > 15° deviation |
| Incomplete lockout | Deadlift | Hip angle at top | < 170° |
| Inconsistent touch point | Bench | Bar X variance at chest across reps | > 3cm |

## Phases

- **Phase 1:** Bar path overlay + rep metrics + form fault detection (this doc)
- **Phase 2:** LLM coaching from metrics + training context, personal baselines from 5+ videos, longitudinal comparison, front-view support, real-time overlay, cloud backup
