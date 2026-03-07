# Spec: Ad-Hoc Auxiliary Exercises

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

Allows users to add any exercise to a live session beyond the prescribed auxiliary block, and log sets for it exactly like prescribed work.

## Tasks

### `apps/parakeet/src/platform/store/sessionStore.ts`

- Added `addAdHocSet(exercise: string)` action to the store interface and implementation
- Appends a new `AuxiliaryActualSet` to `auxiliarySets` for the given exercise
- `set_number` is derived from existing sets for that exercise (`existing.length + 1`)
- Weight/reps default to the previous set's values (or 0g / 5 reps if first set)
- Persisted to AsyncStorage via the existing `partialize` config (no changes needed)

### `apps/parakeet/src/app/(tabs)/session/[sessionId].tsx`

**New local state:**
- `adHocExercises: string[]` — ordered list of ad-hoc exercise names added this session
- `addExerciseVisible: boolean` — modal open state
- `exerciseInput: string` — controlled text input value

**New handlers:**
- `handleConfirmAddExercise()` — normalises input (trim, lowercase, spaces→underscores), guards against duplicates, calls `addAdHocSet`, appends to `adHocExercises`, closes modal
- `handleAddAdHocSet(exercise)` — calls `addAdHocSet` to append another set row

**Resume path (existing session branch in `useEffect`):**
- Derives ad-hoc exercises on return by diffing `auxiliarySets` against prescribed `auxiliaryWork`
- Any exercise in the store not in the prescribed list is added to `adHocExercises`

**Rendering:**
- Aux section now renders when `auxiliaryWork.length > 0 || adHocExercises.length > 0`
- Ad-hoc exercises render after prescribed ones inside the same "Auxiliary Work" section
- Each ad-hoc exercise header has a `+ Set` button (inline, right-aligned)
- A `+ Add Exercise` dashed-border button sits below the aux section at all times
- `SetRow` and `handleAuxSetUpdate` are reused unchanged for ad-hoc sets

**Modal:**
- RN `Modal` with `transparent` + `fade` animation
- Single `TextInput` with `autoFocus`, `returnKeyType="done"`, submits on Return
- Cancel clears input and closes; Add normalises and commits

## Behaviour Notes

- Ad-hoc sets flow into `completeSession` via `auxiliarySets` unchanged — no extra wiring needed
- Rest timer for ad-hoc sets falls back to `DEFAULT_AUX_REST_SECONDS` (no JIT recommendation available for them)
- Exercise name stored internally as `snake_case`; displayed via existing `formatExerciseName()` helper
- Duplicate exercise names (same name added twice) are silently ignored

## Dependencies

- [mobile-005-session-logging-screen.md](./mobile-005-session-logging-screen.md)
