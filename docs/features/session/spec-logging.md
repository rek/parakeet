# Spec: Session Logging Screen

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

The live workout logging screen where users check off sets, adjust weights and reps, and submit their completed session.

## Tasks

**`apps/parakeet/app/session/[sessionId].tsx`:**
- On mount:
  1. Fetch session from Supabase — `planned_sets` already populated by JIT (run on soreness screen)
  2. Fetch warmup config for this lift and generate warmup sets via `generateWarmupSets()`
  3. Call `startSession()` to mark in_progress
  4. Initialize Zustand `sessionStore` with planned sets as starting values

### Open Issues (2026-05 review)

- [x] (landed) **No loading UI between mount and bootstrap resolution.** The screen renders full scaffolding (header, "Working Sets", empty maps) on first frame before the bootstrap effect resolves the session, producing a blank skeleton with `liftHeader=''` and a disabled Complete button. If `getSession` rejects or returns null, `router.back()` fires with no toast or alert. Add an explicit `bootstrapped` boolean, render an `ActivityIndicator` until session meta + JIT data resolve, and surface an Alert when `getSession` returns null.
- [ ] **Silent JSON parse failure on stale route params.** Malformed `effectiveJitData` triggers `router.back()` silently. Show an `Alert.alert('Session data corrupted', ...)` before navigating away and `captureException` on the parse error.
- [x] (landed) **Recovery dead-end when JIT cache is missing AND `planned_sets` is NULL.** If a user starts a session, the JIT cache evicts, and the session row's `planned_sets` was never persisted (crash mid-JIT), there is no path to re-JIT for an already-in-progress session — `[sessionId].tsx` only routes back. Detect this state and redirect through the soreness/JIT flow with the `in_progress` status preserved.
- [x] (landed) **Bootstrap effect is mixing orchestration, sync gating, store reconciliation.** Lines 566-718 parse JIT JSON, decide session-init vs jit-changed vs resume, flush unsynced sets, restore ad-hoc exercises, and start the session — all inline. Extract `modules/session/application/session-bootstrap.service.ts` (or `useSessionBootstrap`). Also `templateBlocks` (760-773) is pure data massage that belongs in `modules/session/utils/groupTemplateBlocks.ts`.
- [ ] **`LiftHistorySheet` empty state.** Verify the component renders a "No history yet" copy when `data?.entries?.length === 0`; if missing, add it inside the component.
- Screen layout:
  - Header: lift name, intensity type badge, block/week info
  - **Collapsible warmup section** above working sets (see [parakeet-013-warmup-display.md](./parakeet-013-warmup-display.md))
  - Scrollable list of `SetRow` components (one per planned working set)
  - **Auxiliary Work section** below working sets: one sub-section per exercise with exercise name header + `SetRow` per set; skipped exercises (high soreness/MRV exceeded) show muted skip reason text instead of rows
  - "Complete Workout" sticky footer button (enabled after at least 1 set is checked)

**`apps/parakeet/components/training/SetRow.tsx`:**
- Props: `setNumber`, `plannedWeight`, `plannedReps`, `onUpdate: (actualWeight, actualReps, rpe) => void`
- State: `actualWeight` (starts = plannedWeight), `actualReps` (starts = plannedReps), `rpe` (optional), `isCompleted`
- Tap weight field → numeric keyboard with +/- 2.5 increment buttons
- Tap reps field → numeric keyboard
- RPE selector (optional): horizontal slider, 6.0 to 10.0 in 0.5 increments; label shows "Easy / Moderate / Hard / Max"
- Checkmark button → marks set complete, slight visual transition (green tint)
- Checkmark is tappable again to un-complete a set (user can correct mistakes)

**`apps/parakeet/store/sessionStore.ts` (Zustand):**

- State: `{ sessionId, plannedSets, actualSets: ActualSet[], auxiliarySets: AuxiliaryActualSet[], sessionRpe, startedAt }`
- Actions: `updateSet`, `updateAuxiliarySet(exercise, setNumber, data)`, `initAuxiliary(work)`, `addAdHocSet(exercise)`, `setSessionRpe`, `reset()`
- See also [mobile-030-ad-hoc-auxiliary-exercises.md](./mobile-030-ad-hoc-auxiliary-exercises.md) for ad-hoc exercise logging

**`apps/parakeet/app/session/complete.tsx`:**
- Summary view after submitting:
  - Planned vs. actual volume bars
  - Completion percentage
  - Session RPE (if provided)
  - Notes field (free text, optional)
  - "Save & Finish" button → call `completeSession(sessionId, payload)` from `apps/parakeet/lib/sessions.ts`, navigate to `/(tabs)/today`

**Note field (`apps/parakeet/components/training/SessionNotes.tsx`):**
- Expandable text area at bottom of session screen
- Auto-saved to sessionStore as user types

## Dependencies

- [parakeet-004-today-screen.md](./parakeet-004-today-screen.md)
- [parakeet-013-warmup-display.md](./parakeet-013-warmup-display.md)
- [sessions-003-session-completion-api.md](./spec-completion.md)
- [parakeet-009-offline-sync.md](./parakeet-009-offline-sync.md)
