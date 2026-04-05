# mobile-048: Set-Level Video Linking

**Status:** Done
**Design:** [set-level-video-linking.md](../../design/set-level-video-linking.md)
**Depends on:** mobile-046 (video form analysis, all phases)
**Enables:** mobile-047 (competition readiness — needs per-set weight/RPE)

## What This Covers

Extend `session_videos` to associate videos with a specific set number. `set_number` is required (default 1) — existing rows backfill to 1. Update repository, hook, and screen to be set-aware. Longitudinal queries support both "all videos for lift" and "filter by set number".

## Phase 1 — Data model + repository + hook wiring

### 1.1 — Migration: add set_number

- [x] `ALTER TABLE session_videos ADD COLUMN set_number integer NOT NULL DEFAULT 1`
- [x] `CHECK (set_number > 0)`
- [x] Index: `idx_session_videos_session_lift_set ON session_videos(session_id, lift, set_number)` (mobile-052 dropped `camera_angle` column)
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

> The header-level `VideoEntryButton` (Decision 3 "secondary / backward compat") is removed. PostRestOverlay recording ([mobile-051](./mobile-051-post-rest-recording.md)) replaces it as the primary in-session recording path.

### 2.1 — SetVideoIcon component

> **Note (mobile-051):** SetVideoIcon remains the post-completion entry point for camera roll import. For pre-set in-app recording, see PostRestOverlay integration in [mobile-051](./mobile-051-post-rest-recording.md).

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

- [x] Migration `20260331000000`: `set_weight_grams integer`, `set_reps integer`, `set_rpe numeric(3,1)` on session_videos (all nullable, backward compatible)
- [x] `supabase/types.ts` updated with Row/Insert/Update fields
- [x] `SessionVideo` model type updated with `setWeightGrams`, `setReps`, `setRpe`
- [x] `video.repository.ts` — `toSessionVideo` maps new columns, `insertSessionVideo` accepts them

### 3.2 — Set-aware analysis screen title

- [x] "Squat — Set 3 @ 140kg × 3 (RPE 8)" when set context present via query params
- [x] Falls back to "{liftLabel} Form Analysis" when no set context

### 3.3 — Update assembleCoachingContext

- [x] Accepts `setContext` param with `weightGrams`, `reps`, `rpe`
- [x] Uses `setWeightGrams / 1000` as `weightKg` when present (falls back to max-weight heuristic)
- [x] Uses `setRpe` as `sessionRpe` when present (falls back to `log.session_rpe`)
- [x] `useFormCoaching` passes video's set context through
- [x] `useVideoAnalysis` accepts `setContext` param, passes to `insertSessionVideo`
- [x] `SetVideoIcon` passes `weightGrams`, `reps`, `rpe` as nav params from session screen

## Phase 4 — Multi-video browsing + set comparison

### 4.1 — Session videos list

- [x] "OTHER SETS" section on video analysis screen when multiple videos exist for session+lift
- [x] Chip per set with weight context; tapping switches via `router.replace` with full set context params

### 4.2 — IntraSessionComparison component

- [x] `modules/video-analysis/ui/IntraSessionComparison.tsx` — renders null when <2 videos
- [x] Overlaid bar paths colored by set number (5 distinct colorblind-friendly colors)
- [x] Drift/lean/depth trend table per set
- [x] Fatigue narrative when bar drift increases monotonically across 3+ sets

### 4.3 — useSessionVideos hook

- [x] `getVideosForSessionLift` repository function (ordered by set_number)
- [x] `videoQueries.forSessionLift` query factory
- [x] `useSessionVideos` hook exported from module index

## Sequencing

```
Phase 1 (data + wiring) ✅ → Phase 2 (per-set UI) ──┐
                              Phase 3 (set context) ──┤→ Phase 4 (comparison)
```

Phases 2 and 3 are independent and can run in parallel.
