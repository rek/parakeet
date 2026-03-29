# mobile-048: Set-Level Video Linking

**Status:** Planned
**Design:** [set-level-video-linking.md](../../design/set-level-video-linking.md)
**Depends on:** mobile-046 (video form analysis, all phases)
**Enables:** mobile-047 (competition readiness — needs per-set weight/RPE)

## What This Covers

Extend `session_videos` to associate videos with a specific set number. Maintain backward compat — existing videos with `set_number = null` work as "whole lift" videos. Update session screen, analysis screen, coaching context, and comparison to be set-aware.

## Phase 1 — Data model + repository

### 1.1 — Migration: add set columns

- [ ] `ALTER TABLE session_videos ADD COLUMN set_number integer;` (nullable)
- [ ] `ALTER TABLE session_videos ADD COLUMN set_weight_grams integer;` (snapshot)
- [ ] `ALTER TABLE session_videos ADD COLUMN set_reps integer;`
- [ ] `ALTER TABLE session_videos ADD COLUMN set_rpe numeric(3,1);`
- [ ] Index: `idx_session_videos_session_lift_set ON session_videos(session_id, lift, set_number)`
- [ ] Constraint: `chk_set_number_positive CHECK (set_number IS NULL OR set_number > 0)`

### 1.2 — Update SessionVideo model type

- [ ] Add `setNumber: number | null`, `setWeightGrams: number | null`, `setReps: number | null`, `setRpe: number | null`

### 1.3 — Update video.repository.ts

- [ ] Update `SessionVideoRow` + `toSessionVideo()` mapper
- [ ] Update `insertSessionVideo()` — accept optional set fields, include only when non-null
- [ ] Add `getVideoForSet({ sessionId, lift, setNumber, cameraAngle })` — single video query
- [ ] Add `getVideosForSessionLift({ sessionId, lift })` — returns all videos ordered by `set_number ASC NULLS FIRST, created_at DESC`

## Phase 2 — UI: per-set entry on session screen

### 2.1 — SetVideoIcon component

- [ ] `modules/video-analysis/ui/SetVideoIcon.tsx` — small camera icon, feature-flag gated
- [ ] Props: sessionId, lift, setNumber, setWeightGrams, setReps, setRpe, isCompleted
- [ ] Only renders when isCompleted = true
- [ ] Navigates to `/session/video-analysis` with set params
- [ ] Shows filled indicator when video exists for this set

### 2.2 — Integrate into SetRow

- [ ] `modules/session/ui/SetRow.tsx` — accept optional `sessionId`, `lift`, `showVideoIcon`
- [ ] Render `<SetVideoIcon>` on completed main lift sets

### 2.3 — Pass from session screen

- [ ] `app/(tabs)/session/[sessionId].tsx` — pass `sessionId`, `lift`, `showVideoIcon={true}` to main lift SetRows

## Phase 3 — Analysis screen: set-aware context

### 3.1 — Parse set params

- [ ] Read `setNumber`, `setWeightGrams`, `setReps`, `setRpe` from search params
- [ ] Update title: "Squat — Set 3 @ 140kg x 3 (RPE 8)" when set context present

### 3.2 — Update useVideoAnalysis

- [ ] Accept optional set params, pass through to `insertSessionVideo()`
- [ ] `loadExisting`: if `setNumber` provided, call `getVideoForSet()` instead

### 3.3 — Update assembleCoachingContext

- [ ] Add set fields to `FormCoachingContext`
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

- [ ] Fetches all videos for session+lift via `getVideosForSessionLift()`

## Phase 5 — Backward compat + tests

- [ ] Existing videos (set_number = null) display as "General"
- [ ] `getVideoForSessionLift()` prefers null set_number via `NULLS FIRST`
- [ ] Coaching context falls back to max-weight heuristic when setNumber is null
- [ ] Repository tests: insert with set fields, getVideoForSet, ordering
- [ ] assembleCoachingContext test: set-level weight overrides max-weight heuristic

## Sequencing

```
Phase 1 (data) → Phase 2 (per-set UI) ──┐
                 Phase 3 (set-aware)  ───┤→ Phase 4 (comparison) → Phase 5 (tests)
```

Phases 2 and 3 are independent and can run in parallel.
