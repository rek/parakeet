# Spec: Session Logging Screen

**Status**: Implemented
**Domain**: Mobile App

## What This Covers

The live workout logging screen where users check off sets, adjust weights and reps, and submit their completed session.

## Tasks

**`apps/mobile/app/session/[sessionId].tsx`:**
- On mount:
  1. Fetch session from Supabase — `planned_sets` already populated by JIT (run on soreness screen)
  2. Fetch warmup config for this lift and generate warmup sets via `generateWarmupSets()`
  3. Call `startSession()` to mark in_progress
  4. Initialize Zustand `sessionStore` with planned sets as starting values
- Screen layout:
  - Header: lift name, intensity type badge, block/week info
  - **Collapsible warmup section** above working sets (see [mobile-013-warmup-display.md](./mobile-013-warmup-display.md))
  - Scrollable list of `SetRow` components (one per planned working set)
  - "Complete Workout" sticky footer button (enabled after at least 1 set is checked)

**`apps/mobile/components/training/SetRow.tsx`:**
- Props: `setNumber`, `plannedWeight`, `plannedReps`, `onUpdate: (actualWeight, actualReps, rpe) => void`
- State: `actualWeight` (starts = plannedWeight), `actualReps` (starts = plannedReps), `rpe` (optional), `isCompleted`
- Tap weight field → numeric keyboard with +/- 2.5 increment buttons
- Tap reps field → numeric keyboard
- RPE selector (optional): horizontal slider, 6.0 to 10.0 in 0.5 increments; label shows "Easy / Moderate / Hard / Max"
- Checkmark button → marks set complete, slight visual transition (green tint)
- Checkmark is tappable again to un-complete a set (user can correct mistakes)

**`apps/mobile/store/sessionStore.ts` (Zustand):**
- State: `{ sessionId, plannedSets, actualSets: ActualSet[], sessionRpe, sessionNotes, startedAt }`
- Actions: `updateSet(setNumber, data)`, `completeSet(setNumber)`, `setSessionRpe(rpe)`, `reset()`
- Persisted to MMKV for crash recovery (user can close app and return to in-progress session)

**`apps/mobile/app/session/complete.tsx`:**
- Summary view after submitting:
  - Planned vs. actual volume bars
  - Completion percentage
  - Session RPE (if provided)
  - Notes field (free text, optional)
  - "Save & Finish" button → call `completeSession(sessionId, payload)` from `apps/mobile/lib/sessions.ts`, navigate to `/(tabs)/today`

**Note field (`apps/mobile/components/training/SessionNotes.tsx`):**
- Expandable text area at bottom of session screen
- Auto-saved to sessionStore as user types

## Dependencies

- [mobile-004-today-screen.md](./mobile-004-today-screen.md)
- [mobile-013-warmup-display.md](./mobile-013-warmup-display.md)
- [../07-sessions/sessions-003-session-completion-api.md](../07-sessions/sessions-003-session-completion-api.md)
- [mobile-009-offline-sync.md](./mobile-009-offline-sync.md)
