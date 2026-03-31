# mobile-048: Set-Level Video Linking

**Status:** Phase 1 complete
**Design:** [set-level-video-linking.md](../../design/set-level-video-linking.md)
**Depends on:** mobile-046 (video form analysis, all phases)
**Enables:** mobile-047 (competition readiness — needs per-set weight/RPE)

## What This Covers

Extend `session_videos` to associate videos with a specific set number. `set_number` is required (default 1) — existing rows backfill to 1. Update repository, hook, and screen to be set-aware. Longitudinal queries support both "all videos for lift" and "filter by set number".

## Phase 1 — Data model + repository + hook wiring

### 1.1 — Migration: add set_number

- [x] `ALTER TABLE session_videos ADD COLUMN set_number integer NOT NULL DEFAULT 1`
- [x] `CHECK (set_number > 0)`
- [x] Index: `idx_session_videos_session_lift_set_angle ON session_videos(session_id, lift, set_number, camera_angle)`
- [x] Drop old `idx_session_videos_session_lift_angle`

### 1.2 — Update supabase/types.ts

- [x] Add `set_number: number` to Row, `set_number?: number` to Insert/Update

### 1.3 — Update SessionVideo model type

- [x] Add `setNumber: number`

### 1.4 — Update video.repository.ts

- [x] Use `DbRow<'session_videos'>` instead of hand-written row type
- [x] Use `fromJson`/`toJson` helpers instead of raw casts
- [x] `insertSessionVideo()` — accept required `setNumber`, include in insert
- [x] `getVideoForSessionLift()` — accept required `setNumber`, filter by it
- [x] `getVideosForLift()` — accept optional `setNumber`, conditionally filter

### 1.5 — Update useVideoAnalysis hook

- [x] Accept `setNumber: number` param
- [x] Pass to `insertSessionVideo` and `getVideoForSessionLift`
- [x] Include set number in saved filename
- [x] Add `setNumber` to dependency arrays

### 1.6 — Update video-analysis screen

- [x] Parse `setNumber` from search params (default 1)
- [x] Pass to `useVideoAnalysis`

## Phase 2 — UI: per-set entry on session screen

### 2.1 — SetVideoIcon component

- [x] `modules/video-analysis/ui/SetVideoIcon.tsx` — small camera icon, feature-flag gated internally via `useFeatureEnabled('videoAnalysis')`
- [x] Props: sessionId, lift, setNumber, isCompleted
- [x] Only renders when isCompleted = true (all hooks before early returns)
- [x] Navigates to `/session/video-analysis` with set params
- [x] Shows filled indicator (📹) when video exists, empty (📷) when not; uses `useSetVideo` hook + `video.queries.ts` factory

### 2.2 — Integrate into SetRow

- [x] `modules/session/ui/SetRow.tsx` — accepts `videoIconSlot?: ReactNode` (slot pattern avoids session→video-analysis circular dependency)
- [x] Rendered after the check button on completed sets

### 2.3 — Pass from session screen

- [x] `app/(tabs)/session/[sessionId].tsx` — passes `videoIconSlot={<SetVideoIcon .../>}` to main lift SetRows. Cross-module composition happens at the app/ layer.

## Phase 3 — Set-level context enrichment

### 3.1 — Snapshot set context columns

- [ ] Migration: `set_weight_grams integer`, `set_reps integer`, `set_rpe numeric(3,1)` on session_videos
- [ ] Update types and repository

### 3.2 — Set-aware analysis screen title

- [ ] "Squat — Set 3 @ 140kg x 3 (RPE 8)" when set context present

### 3.3 — Update assembleCoachingContext

- [ ] Use `setWeightGrams / 1000` as `weightKg` when present (instead of max-weight heuristic)
- [ ] Use `setRpe` instead of `sessionRpe` when present

## Phase 4 — Multi-video browsing + set comparison

### 4.1 — Session videos list

- [ ] List all videos for session+lift below the current single-video view
- [ ] Tapping switches the displayed video

### 4.2 — IntraSessionComparison component

- [ ] `modules/video-analysis/ui/IntraSessionComparison.tsx`
- [ ] Overlaid bar paths colored by set number
- [ ] Drift/lean/depth trend across set numbers
- [ ] Fatigue narrative when drift increases monotonically

### 4.3 — useSessionVideos hook

- [ ] Fetches all videos for session+lift

## Sequencing

```
Phase 1 (data + wiring) ✅ → Phase 2 (per-set UI) ──┐
                              Phase 3 (set context) ──┤→ Phase 4 (comparison)
```

Phases 2 and 3 are independent and can run in parallel.
