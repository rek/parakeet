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

**`apps/parakeet/src/app/settings/auxiliary-exercises.tsx`:**
- [x] Local `MuscleChips` component — calls `getPrimaryMuscles(exerciseName)` inline (not from DB), renders chips via `MUSCLE_LABELS_COMPACT`
- [x] Chips rendered below exercise name in pool list; returns null for unknown exercises
- [x] Styles: `chipRow`, `chip` (primaryMuted bg), `chipText` (10px, primary color)

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

## Dependencies

- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
- [engine-008-auxiliary-exercise-rotation.md](../04-engine/engine-008-auxiliary-exercise-rotation.md)
- Design: [auxiliary-exercise-types.md](../../design/auxiliary-exercise-types.md)
