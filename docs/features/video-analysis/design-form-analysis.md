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
| 3 | Camera angle | Continuous sagittal confidence (0-1), works from any angle | Binary side/front classification fails at intermediate angles (~30-60°), which is where most gym videos are filmed. Continuous confidence score (1.0 = pure side, 0.0 = pure front) eliminates the binary cliff. Metrics always computed with confidence-weighted corrections. See mobile-052. |
| 4 | Supported lifts | All three (squat, bench, deadlift) | Same CV pipeline — only the interpretation layer (which angles, what thresholds) differs per lift. Lift known from session context. |
| 5 | Video source | In-app recording (primary) + camera roll pick (secondary) | In-app recording via PostRestOverlay is primary — records before the set with full context (mobile-051). Camera roll import via SetVideoIcon on completed rows for lifters who film with native camera. |
| 6 | Video-to-lift association | Video belongs to a session + lift | Not per-set — too much friction. One video per lift per session. Enables longitudinal comparison ("all my squat videos"). |
| 7 | Storage | Compressed local (expo-file-system) | ~5-8MB per 30s video. Raw video stays on-device — backlog #17 dropped the Supabase Storage upload path in 2026-04-19 after the audit showed no consumer read `remote_uri` for playback. See [design-local-only-storage.md](./design-local-only-storage.md). |
| 8 | Display layers | Bar path overlay → rep metrics card → LLM coaching | Layers 1+2 in Phase 1. LLM coaching (layer 3) is Phase 2 — just a `generateText()` call once metrics exist. |
| 9 | Entry points | PostRestOverlay (record before lifting, mobile-051) + per-set SetVideoIcon (camera roll import after completion) + history detail ("Add Video" / "View Analysis") | PostRestOverlay is primary — full set context, natural timing. SetVideoIcon for camera roll import. History link for retrospective add. Header-level camera icon removed — superseded by mobile-048 + mobile-051. |
| 10 | Rep detection | Automatic from joint angle periodicity | Joint angles (knee angle for squat/DL, elbow angle for bench) are viewpoint-invariant — a rep oscillates the same way regardless of camera position. Replaces hip/wrist Y-coordinate method which compressed at oblique angles. See mobile-052. |
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
- **Current (mobile-052):** Joint angle periodicity — knee angle (squat/DL) or elbow angle (bench) oscillates with reps regardless of camera angle. Viewpoint-invariant. Based on PoseRAC approach (arXiv 2308.08632v2).
- **Legacy:** Hip/wrist Y-coordinate traces a sine wave — compressed at oblique camera angles, causing false peaks. Retained as fallback when landmarks are not visible.
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
  "sagittalConfidence": 0.85,
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
- **Phase 2:** LLM coaching from metrics + training context, personal baselines from 5+ videos, longitudinal comparison, front-view support, real-time overlay, cloud backup (implemented)
- **Phase 3:** Set-level video linking — per-set context, intra-session comparison (implemented, mobile-048)
- **Phase 4:** PostRestOverlay recording integration — record before lifting with full set context, remove redundant header entry point (mobile-051)
- **Phase 5:** View angle rework — continuous sagittal confidence, joint-angle rep detection, always-compute metrics (mobile-052)
