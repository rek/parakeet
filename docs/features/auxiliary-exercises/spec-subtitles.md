# Spec: Exercise Subtitles (GH#205)

**Status**: Implemented

**Domain**: Training Engine | UI

## What This Covers

Adds an optional `subtitle` field to `ExerciseCatalogEntry`, splits Rack Pull into two catalog entries (above/below knee), creates a shared `ExerciseName` component, and updates all five UI locations to show the subtitle.

## Tasks

**`packages/training-engine/src/auxiliary/exercise-catalog.ts`:**

- [x] Add `subtitle?: string` to `ExerciseCatalogEntry` interface
  → `packages/training-engine/src/auxiliary/exercise-catalog.ts:ExerciseCatalogEntry`
- [x] Add `subtitle: 'Above the knee'` to existing `Rack Pull` entry
  → `packages/training-engine/src/auxiliary/exercise-catalog.ts`
- [x] Add new `Rack Pull Below Knee` entry: `associatedLift: 'deadlift'`, `subtitle: 'Below the knee'`, `weightPct: 0.95`, `repTarget: 4`, same muscle contributions as Rack Pull
  → `packages/training-engine/src/auxiliary/exercise-catalog.ts`

**`docs/domain/exercise-catalog.md`:**

- [x] Add `Rack Pull Below Knee` row (weightPct 0.95) with subtitle column
  → `docs/domain/exercise-catalog.md`

**`apps/parakeet/src/shared/utils/string.ts`:**

- [x] Move `formatExerciseName` here from `modules/session/utils/` (session re-exports via thin shim)
  → `apps/parakeet/src/shared/utils/string.ts:formatExerciseName`

**`apps/parakeet/src/shared/utils/exercise-lookup.ts`:**

- [x] Add `getExerciseSubtitle(name)` — normalizes snake_case/Title Case, returns `subtitle` from catalog
  → `apps/parakeet/src/shared/utils/exercise-lookup.ts:getExerciseSubtitle`

**`apps/parakeet/src/shared/ui/ExerciseName.tsx`** (new file):

- [x] `ExerciseName({ name, nameStyle? })` — renders formatted name + optional subtitle line
  → `apps/parakeet/src/shared/ui/ExerciseName.tsx`

**`apps/parakeet/src/app/(tabs)/session/[sessionId].tsx`:**

- [x] Replace three `formatExerciseName` Text blocks with `<ExerciseName>`
  → `apps/parakeet/src/app/(tabs)/session/[sessionId].tsx`

**`apps/parakeet/src/modules/session/ui/AuxResultsTable.tsx`:**

- [x] Replace `capitalize(exercise.replace(/_/g, ' '))` with `<ExerciseName>`
  → `apps/parakeet/src/modules/session/ui/AuxResultsTable.tsx`

**`apps/parakeet/src/modules/session/ui/AddExerciseModal.tsx`:**

- [x] Replace both exercise name Text elements with `<ExerciseName>`
  → `apps/parakeet/src/modules/session/ui/AddExerciseModal.tsx`

**`apps/parakeet/src/app/settings/auxiliary-exercises.tsx`:**

- [x] Replace pool exercise Text with `<ExerciseName>`
  → `apps/parakeet/src/app/settings/auxiliary-exercises.tsx`

**`apps/parakeet/src/modules/formula/ui/SlotDropdown.tsx`:**

- [x] Replace option row Text and trigger Text with `<ExerciseName>`
  → `apps/parakeet/src/modules/formula/ui/SlotDropdown.tsx`
