# Spec: Auxiliary Exercise Config

**Status**: Implemented
**Domain**: Data / User Config

## What This Covers

Management of the user's auxiliary exercise pool per lift and the active block assignments. Users can reorder the pool (which affects future rotation), add custom exercises, or manually lock/swap individual block assignments. Defaults come from `DEFAULT_AUXILIARY_POOLS` in the training engine.

## Tasks

**Tables (already defined in infra-005):**
- `auxiliary_exercises` — user's ordered pool per lift
- `auxiliary_assignments` — which 2 exercises are active per lift per block

**`apps/parakeet/lib/auxiliary-config.ts`:**
- [x] `getAuxiliaryPool(userId: string, lift: Lift): Promise<string[]>` — fetch ordered pool, falling back to `DEFAULT_AUXILIARY_POOLS[lift]` if no rows
- [x] `reorderAuxiliaryPool(userId: string, lift: Lift, orderedExercises: string[]): Promise<void>` — delete existing and reinsert in new order
- [x] `getActiveAssignments(userId: string, programId: string, blockNumber: 1 | 2 | 3): Promise<Record<Lift, [string, string]>>` — fetch active assignments for a given program block
- [x] `lockAssignment(userId: string, programId: string, lift: Lift, blockNumber: 1 | 2 | 3, exercise1: string, exercise2: string): Promise<void>` — manually override a block assignment with `is_locked: true`

**Settings screen — Auxiliary Exercises (`apps/parakeet/app/(tabs)/settings.tsx`):**
- [x] Shows 3 sections: Squat, Bench, Deadlift
- [x] Each section: ordered list with drag handles for reordering
- [x] "Add exercise" text input at bottom of each section
- [x] Current block assignment shown with lock icon toggle
- [x] Tap lock to override this block's pair; tap again to revert to calculated rotation

### Muscle Mapping Extension (Feature 1) — Implemented

Wire up the engine's existing `EXERCISE_MUSCLES` map to the `primary_muscles` column in the DB and show muscles in the UI.

**`apps/parakeet/src/modules/program/utils/auxiliary-muscles.ts`** (new file):
- [x] `getPrimaryMuscles(exerciseName: string): string[]` — calls `getMusclesForExercise(name)` from `@parakeet/training-engine`, filters to `contribution >= 1.0`, returns muscle name strings
  - Returns `[]` for exercises not in the engine's map (custom user-added exercises)
- [x] Exported from `apps/parakeet/src/modules/program/index.ts`

**`apps/parakeet/src/modules/program/lib/auxiliary-config.ts`:**
- [x] `reorderAuxiliaryPool` — uses `getPrimaryMuscles(name)` to populate `primary_muscles` on insert

**`apps/parakeet/src/components/settings/MuscleChips.tsx`** (extracted component):
- [x] Calls `getPrimaryMuscles(exerciseName)` (not from DB), renders chips via `MUSCLE_LABELS_COMPACT`
- [x] Returns null for exercises with no mapped muscles
- [x] Used in both `PoolList` and `SlotDropdown`

**`apps/parakeet/src/app/settings/auxiliary-exercises.tsx`:**
- [x] Imports `MuscleChips` from `components/settings/MuscleChips`

**DB backfill:**
- No migration needed — `primary_muscles text[]` column already exists; repopulates on next Save Pool tap

### Exercise Type System (Bug 1) — Implemented

Some aux exercises are not weighted movements. Pull-ups are bodyweight; Assault Bike is timed cardio.

**`packages/training-engine/src/auxiliary/exercise-types.ts`** (new file):
- [x] `ExerciseType = 'weighted' | 'bodyweight' | 'timed'` — exported union type
- [x] `EXERCISE_TYPES: Record<string, ExerciseType>` — covers all pool exercises + BODYWEIGHT_POOLS + common user-added exercises (Pull-ups, Dips, Push-ups, etc.)
- [x] `getExerciseType(name: string): ExerciseType` — defaults to `'weighted'` for unknowns
- [x] Exported from `packages/training-engine/src/modules/auxiliary/index.ts`

**`packages/training-engine/src/generator/jit-session-generator.ts`:**
- [x] `AuxiliaryWork` interface gains `exerciseType: ExerciseType`
- [x] `buildAuxiliaryWork` uses `getExerciseType()` per exercise:
  - `timed`: MRV check skipped; generates single set with `weight_kg: 0, reps: 0`
  - `bodyweight`: `weight_kg: 0`; normal rep target and set count
  - `weighted`: unchanged behaviour
- [x] Bodyweight disruption exercises tagged as `exerciseType: 'bodyweight'`
- [x] `llm-jit-generator.ts` updated to include `exerciseType: 'weighted'` on generated aux

**`packages/shared-types/src/session-log.schema.ts`:**
- [x] `ActualSetSchema` — optional `exercise_type: z.enum(['weighted', 'bodyweight', 'timed'])`

**`apps/parakeet/src/components/training/SetRow.tsx`:**
- [x] `exerciseType` prop (defaults to `'weighted'`)
- [x] `timed`: renders "Complete / as prescribed" + check button only
- [x] `bodyweight`: hides weight input, kg label, plate button, ±2.5 buttons; shows reps only
- [x] `weighted`: unchanged

**`apps/parakeet/src/app/(tabs)/session/[sessionId].tsx`:**
- [x] Local `AuxiliaryWork` interface includes optional `exerciseType`
- [x] `exerciseType` passed through to `SetRow` when rendering aux sets

**Note:** `bodyweight` exercises still count toward MRV via muscle mapper (correct). `timed` exercises skip MRV gating entirely.

### Block Assignment UX — Dropdown with Search (Bug Fix)

The original `SlotPicker` used left/right arrows to cycle through exercises one at a time — unusable with large pools.

**`apps/parakeet/src/components/settings/SlotDropdown.tsx`** (new component):
- [x] Tap trigger shows current exercise name + chevron
- [x] Opens a bottom-sheet `Modal` with `TextInput` search bar + `FlatList` of pool exercises
- [x] Filters by case-insensitive substring match as user types
- [x] Each row shows exercise name + `MuscleChips`; currently-selected exercise highlighted in primary colour
- [x] Cancel button closes without changing selection
- [x] Replaces `SlotPicker` in `LiftSection` (two instances: Slot 1 + Slot 2)

### Exercise Catalog (Single Source of Truth) — Implemented

All exercise metadata previously scattered across `DEFAULT_AUXILIARY_POOLS`, `EXERCISE_TYPE_MAP`, and `EXERCISE_MUSCLES` is now consolidated in a single file.

**`packages/training-engine/src/auxiliary/exercise-catalog.ts`** (new file):
- [x] `ExerciseCatalogEntry` interface — `name`, `associatedLift: Lift | null`, `primaryMuscles: MuscleGroup[]`, `type: ExerciseType`
- [x] `EXERCISE_CATALOG` — 53 entries: 6 squat, 9 bench, 11 deadlift (all weighted), 27 general (bodyweight)
- [x] `DEFAULT_AUXILIARY_POOLS` — derived: `EXERCISE_CATALOG.filter(e => e.associatedLift === lift).map(e => e.name)` (replaces inline definition in `auxiliary-rotator.ts`)
- [x] `getAllExercises()` — full catalog minus `timed` entries; used by manual-add picker
- [x] `getPrimaryMusclesForExercise(name)` — returns `MuscleGroup[]` from catalog; `[]` if unknown
- [x] `getLiftForExercise(name)` — returns `Lift | null`

**`packages/training-engine/src/auxiliary/exercise-types.ts`** — refactored:
- [x] `getExerciseType()` delegates to catalog via fast `Map` lookup; retains a small fallback table for user-typed spelling variants not in the catalog

**`packages/training-engine/src/volume/muscle-mapper.ts`** — updated:
- [x] `getMusclesForExercise()` checks detailed `EXERCISE_MUSCLES` map first, then falls back to `getPrimaryMusclesForExercise()` at contribution 1.0

**`packages/training-engine/src/modules/auxiliary/index.ts`** — updated:
- [x] Exports `getAllExercises`, `getLiftForExercise`, `getPrimaryMusclesForExercise`, and `ExerciseCatalogEntry` from the catalog

### Add Exercise Modal UX — Implemented

**`apps/parakeet/src/components/session/AddExerciseModal.tsx`** — extended:
- [x] `defaultLift?: Lift` prop — pre-selects the lift section filter when the modal opens; resets on close/confirm
- [x] `excludeNames?: string[]` prop — exercises in this list render greyed out (opacity 0.45) with an "Added" label and cannot be tapped
- [x] Horizontal filter pill row (All / Squat / Bench / Deadlift / General) below the search input
- [x] Filter and search compose: both active simultaneously
- [x] Section headers hidden when a single lift section is selected (filter makes them redundant)
- [x] Custom free-text fallback ("Add "…"") still available when typed text has no catalog match

### Auxiliary Exercises Settings Screen UX — Implemented

**`apps/parakeet/src/app/settings/auxiliary-exercises.tsx`** — updated:
- [x] `AddExerciseModal` receives `defaultLift={lift}` and `excludeNames={pool}` — modal opens pre-filtered to the relevant lift; already-pooled exercises shown as greyed out "Added"
- [x] `activeProgram` query key uses `qk.program.active(user?.id)` (canonical `@platform/query` key, matching invalidations in the rest of the app)
- [x] Stale assignment validation — when a pool changes, `setAssignments` checks whether the current Slot 1 / Slot 2 exercises are still in the new pool; if not, resets them to `p[0]` / `p[1]`
- [x] `dirtyPools` state tracks unsaved changes per lift; Save Pool button renders outlined/muted when clean, filled primary with "Save Pool ·" when dirty; cleared on save success
- [x] `PoolList` empty state — "No exercises in pool — add one below." shown when pool is empty
- [x] `PoolList` BW badge — bodyweight exercises (via `getExerciseType()`) show a small `BW` chip next to their name

## Dependencies

- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
- [engine-008-auxiliary-exercise-rotation.md](../04-engine/engine-008-auxiliary-exercise-rotation.md)
- Design: [auxiliary-exercise-types.md](../../design/auxiliary-exercise-types.md)
