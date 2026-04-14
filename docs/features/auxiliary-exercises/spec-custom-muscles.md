# Spec: Custom Exercise Muscle Selection

**Status**: Implemented

**Domain**: Training Engine | UI | Data / User Config

## What This Covers

When a user adds a custom exercise (not in catalog), collect muscle group selection and persist it so the training engine can use it for JIT volume top-up, fatigue discounts, and exercise scoring. No schema migration needed — `primary_muscles text[]` already exists in `auxiliary_exercises`.

## Phase 1 — Engine: custom exercise registry

**`packages/training-engine/src/auxiliary/exercise-catalog.ts`:**

- [ ] Add module-level `customExerciseRegistry: Map<string, MuscleGroup[]>`
- [ ] Export `registerCustomExercise(name: string, primaryMuscles: MuscleGroup[]): void` — upserts into registry
- [ ] Export `clearCustomExerciseRegistry(): void` — for test teardown

**`packages/training-engine/src/volume/muscle-mapper.ts`:**

- [ ] In `getMusclesForExercise`, after catalog miss, check `customExerciseRegistry`:
  - If found, return entries mapped to `{ muscle, contribution: 1.0 }`
  - Catalog always takes priority (checked first)

**`packages/training-engine/src/index.ts`:**

- [ ] Export `registerCustomExercise` and `clearCustomExerciseRegistry`

**`packages/training-engine/src/volume/mrv-mev-calculator.test.ts`:**

- [ ] Test: `registerCustomExercise('Custom RDL', ['hamstrings', 'glutes'])` → `getMusclesForExercise('Custom RDL')` returns `[{ muscle: 'hamstrings', contribution: 1.0 }, { muscle: 'glutes', contribution: 1.0 }]`
- [ ] Test: `clearCustomExerciseRegistry()` → `getMusclesForExercise('Custom RDL')` returns `[]`
- [ ] Test: catalog exercise is unaffected by a registry entry with the same name
- [ ] `afterEach`: call `clearCustomExerciseRegistry()` to prevent test bleed

## Phase 2 — UI: muscle picker step in AddExerciseModal

**`apps/parakeet/src/modules/session/ui/AddExerciseModal.tsx`:**

- [ ] Change `onConfirm` prop type to `(exercise: string, primaryMuscles?: MuscleGroup[]) => void`
- [ ] Add state: `customStep: { name: string } | null` — truthy = picker step active
- [ ] Add state: `selectedMuscles: Set<MuscleGroup>`
- [ ] Change "Add '[name]'" tap handler to `setCustomStep({ name })` instead of calling `handleSelect`
- [ ] When `customStep != null`, render muscle picker view (replaces FlatList):
  - Header with back button (`setCustomStep(null); setSelectedMuscles(new Set())`) and title `Select muscles for "{name}"`
  - `MUSCLE_CATALOG` chips grouped by category (Legs / Push / Pull / Core), using `MUSCLE_LABELS_COMPACT`
  - Chip tap toggles `selectedMuscles`; active chips styled with `colors.primary` background
  - "Add Exercise" button — calls `onConfirm(customStep.name, [...selectedMuscles])`; disabled until at least 1 muscle selected
- [ ] `handleClose` resets `customStep` and `selectedMuscles`
- [ ] All hooks before any conditional return (existing `useMemo` hooks stay at top)

## Phase 3 — Caller: thread muscles through auxiliary-exercises screen

**`apps/parakeet/src/app/settings/auxiliary-exercises.tsx`:**

- [ ] `LiftSection` state: add `customMuscles: Record<string, MuscleGroup[]>`
- [ ] `addExercise(name: string, muscles?: MuscleGroup[])` — if `muscles` provided, set `customMuscles[name] = muscles`
- [ ] On remove exercise: remove name from `customMuscles` map
- [ ] Pass `customMuscles` into the save handler — thread through `LiftSectionProps.onSavePool` signature change to `onSavePool(customMuscles: Record<string, MuscleGroup[]>)`
- [ ] `AddExerciseModal.onConfirm`: `(name, muscles) => { addExercise(name, muscles); setPickerVisible(false); }`

## Phase 4 — Data layer: persist and fetch muscles

**`apps/parakeet/src/modules/program/data/auxiliary-config.repository.ts`:**

- [ ] `fetchAuxiliaryExercises`: add `primary_muscles` to `.select()`
- [ ] Return type: `{ exercise_name: string; primary_muscles: string[] }[]`

**`apps/parakeet/src/modules/program/lib/auxiliary-config.ts`:**

- [ ] `reorderAuxiliaryPool`: add optional `customMuscles?: Record<string, MuscleGroup[]>` param
  - Row build: `primary_muscles: customMuscles?.[name] ?? getPrimaryMuscles(name)`
- [ ] Add `getAllAuxMuscleMap(userId: string): Promise<Record<string, string[]>>`
  - Fetches all 3 lift pools in parallel via `fetchAuxiliaryExercises`
  - Returns `{ [exercise_name]: primary_muscles }` for all rows with non-empty muscles
- [ ] Export `getAllAuxMuscleMap` from `modules/program/index.ts`

## Phase 5 — JIT plumbing: register custom muscles before JIT runs

**`apps/parakeet/src/modules/jit/lib/jit.ts`:**

- [ ] Import `registerCustomExercise` from `@parakeet/training-engine`
- [ ] Import `getAllAuxMuscleMap` from `@modules/program`
- [ ] Add `getAllAuxMuscleMap(userId)` to the `Promise.all` at line ~126 (parallel with other fetches)
- [ ] After `Promise.all` resolves, loop over map entries and call `registerCustomExercise(name, muscles as MuscleGroup[])` for each

## Dependencies

- Phase 1 must complete before Phase 5 (registry must exist before registration calls)
- Phase 2 and Phase 3 are independent of Phase 1 (UI can be built in parallel)
- Phase 4 must complete before Phase 5 (`getAllAuxMuscleMap` must exist)
