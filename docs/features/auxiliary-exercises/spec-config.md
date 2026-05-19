# Spec: Auxiliary Exercise Config

**Status**: Implemented
**Domain**: Data / User Config

## What This Covers

Management of the user's auxiliary exercise pools and active block assignments. Users curate one pool per **pool category** (`AuxiliaryPoolCategory = Lift | 'core' | 'cardio'`), reorder it (affects future rotation), add custom exercises, or manually lock/swap individual block assignments. Defaults come from `DEFAULT_AUXILIARY_POOLS`, `DEFAULT_CORE_POOL`, and `DEFAULT_CARDIO_POOL` in the training engine.

### Pool categories

| Category   | Default source                  | Role                                                                              |
|------------|---------------------------------|-----------------------------------------------------------------------------------|
| `squat`    | `DEFAULT_AUXILIARY_POOLS.squat` | Squat-day accessory work; rotates per block.                                      |
| `bench`    | `DEFAULT_AUXILIARY_POOLS.bench` | Bench-day accessory work; rotates per block.                                      |
| `deadlift` | `DEFAULT_AUXILIARY_POOLS.deadlift` | Deadlift-day accessory work; rotates per block.                                |
| `core`     | `DEFAULT_CORE_POOL`             | Volume top-up source for `core` muscle (no compound contributes to core).         |
| `cardio`   | `DEFAULT_CARDIO_POOL`           | Conditioning entries (Run, Row, Ski Erg). Surfaced in pickers; never picked by volume top-up (timed exercises are filtered out before scoring). |

DB enforces the union via `auxiliary_exercises_lift_check` (re-extended in migrations `20260515` for `core` and `20260516` for `cardio`).

## Tasks

**Tables (already defined in infra-005):**
- `auxiliary_exercises` — user's ordered pool per lift
- `auxiliary_assignments` — which 2 exercises are active per lift per block

**`apps/parakeet/lib/auxiliary-config.ts`:**
- [x] `AuxiliaryPoolCategory = Lift | 'core' | 'cardio'` — union covering every pool the settings screen exposes
- [x] `getAuxiliaryPool(userId, category)` — fetch ordered pool, falling back to the per-category default (`DEFAULT_AUXILIARY_POOLS[lift]`, `DEFAULT_CORE_POOL`, or `DEFAULT_CARDIO_POOL`)
- [x] `getAuxiliaryPools(userId)` — returns a `Record<AuxiliaryPoolCategory, string[]>` for the settings screen
- [x] `reorderAuxiliaryPool(userId, category, orderedExercises, customMuscles?, customTypes?)` — delete existing and reinsert in new order; `customTypes` carries user-chosen `ExerciseType` for custom rows
- [x] `getAllAuxMuscleMap(userId)` — flat name → primary muscles map across all categories (seeds `JITInput.customMuscleMap`)
- [x] `getAllAuxTypeMap(userId)` — flat name → `ExerciseType` map for rows where the user set a type (seeds `JITInput.customExerciseTypeMap`)
- [x] `getActiveAssignments(userId, programId, blockNumber)` — fetch active assignments for a given program block
- [x] `lockAssignment(...)` — manually override a block assignment with `is_locked: true`

**Settings screen — Auxiliary Exercises (`apps/parakeet/src/app/settings/auxiliary-exercises.tsx`):**
- [x] Shows 5 sections in order: Squat, Bench, Deadlift, Core, Cardio
- [x] Each section: ordered list with up/down arrows for reordering
- [x] "+ Add Exercise" button per section opens `AddExerciseModal` pre-filtered to that pool category
- [x] Current block assignment shown with lock icon toggle (lift sections only)
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

### Core Pool Category (GH#211) — Implemented

Before this change the settings screen exposed only `squat`/`bench`/`deadlift` even though JIT was already pulling core work from a hardcoded `DEFAULT_CORE_POOL` for volume top-up. Users had no way to see or change the core exercise set.

**Migration** — `supabase/migrations/20260515000000_add_core_to_auxiliary_lift_check.sql`:
- [x] `auxiliary_exercises_lift_check` extended to include `'core'` (joining `'overhead_press'` from migration 20260315)

**`apps/parakeet/src/modules/program/lib/auxiliary-config.ts`:**
- [x] `AuxiliaryPoolCategory = Lift | 'core'` — first introduction of the wider union (later extended to include `'cardio'`)
- [x] `getAuxiliaryPool`/`getAuxiliaryPools`/`reorderAuxiliaryPool` accept the new category; `core` falls back to `DEFAULT_CORE_POOL`

**Settings screen:**
- [x] Adds a 4th "Core" section with the same reorder/add/remove affordances as the lift sections (no block assignment row, since core has no block rotation)

**`AddExerciseModal`:**
- [x] Adds a "Core" filter pill; `defaultLift='core'` restricts the picker to non-timed core exercises (matches `DEFAULT_CORE_POOL` filter)

**JIT integration (`apps/parakeet/src/modules/jit/lib/jit.ts`):**
- [x] Reads `allPools.core` from `getAuxiliaryPools` and merges it into `auxiliaryPool` instead of importing the hardcoded `DEFAULT_CORE_POOL` (ad-hoc fallback unchanged — that path still uses the constant when no user is signed in)

### Cardio Pool Category + Custom Exercise Type Picker (GH#212) — Implemented

Two related bugs surfaced together. A user adding a custom auxiliary exercise had no way to mark it as bodyweight or timed — the modal only asked for muscles, so the engine silently defaulted to `weighted` and tried to load it from the lifter's 1RM. There was also no home for conditioning work like running or rowing, even though those entries existed in the catalog.

**Migration** — `supabase/migrations/20260516000000_add_cardio_and_exercise_type.sql`:
- [x] `auxiliary_exercises_lift_check` extended to include `'cardio'`
- [x] New nullable column `exercise_type text` with `CHECK (exercise_type IS NULL OR exercise_type IN ('weighted','bodyweight','timed'))`. Pre-existing rows stay `NULL` so the catalog/fallback resolver still applies — only rows written from the new type-picker flow set it explicitly.
- [x] No new GRANTs needed (column-add on existing table; table-level grants already in place per `20260513000000_explicit_data_api_grants.sql`).

**`packages/training-engine/src/auxiliary/exercise-types.ts`:**
- [x] `CustomExerciseTypeMap = Readonly<Record<string, ExerciseType>>` — user-supplied overrides
- [x] `createExerciseTyper(customTypeMap?)` — factory that returns a name→type resolver. Catalog wins over the custom map; then custom map; then fallback table; then defaults to `'weighted'`. Mirrors `createMuscleMapper`.
- [x] `getExerciseType(name)` retained as catalog-only resolver for legacy callers

**`packages/training-engine/src/auxiliary/exercise-catalog.ts`:**
- [x] `DEFAULT_CARDIO_POOL` — derived: filters `EXERCISE_CATALOG` for `type === 'timed' && associatedLift === null && !primaryMuscles.includes('core')`. Yields the 5 timed cardio entries (`Row Machine`, `Ski Erg`, `Run - Treadmill`, `Run - Outside`, `Assault Bike`).

**`packages/training-engine/src/generator/jit-session-generator.ts`:**
- [x] `JITInput.customExerciseTypeMap?: CustomExerciseTypeMap` — flows alongside `customMuscleMap`
- [x] `generateJITSession` builds `exerciseTyper = createExerciseTyper(input.customExerciseTypeMap)` and threads it through `buildAuxiliaryWork` and `buildVolumeTopUp`
- [x] All in-file `getExerciseType(name)` call sites swap to `exerciseTyper(name)`
- [x] `processAuxExercise` accepts `exerciseTyper` (defaults to `getExerciseType` for callers that don't have a user context) — single line change at the top resolves the type once and the rest of the function is unchanged

**`packages/training-engine/src/generator/llm-jit-generator.ts`:**
- [x] Builds `exerciseTyper` from `input.customExerciseTypeMap`, passes it into `buildVolumeTopUp`, and uses it where the LLM path resolved type from name

**`apps/parakeet/src/modules/program/data/auxiliary-config.repository.ts`:**
- [x] `PoolCategory` extended to `Lift | 'core' | 'cardio'`
- [x] `fetchAuxiliaryExercises` selects `exercise_type` and returns it alongside `primary_muscles`
- [x] `insertAuxiliaryExercises` carries the optional column (via `DbInsert<'auxiliary_exercises'>` after types regen)

**`apps/parakeet/src/modules/program/lib/auxiliary-config.ts`:**
- [x] `AuxiliaryPoolCategory` widened to include `'cardio'`
- [x] `defaultPoolFor('cardio') === DEFAULT_CARDIO_POOL`
- [x] `getAllAuxTypeMap(userId)` — symmetric to `getAllAuxMuscleMap`; returns `Record<string, ExerciseType>` for rows where the user set a type
- [x] `reorderAuxiliaryPool` accepts an optional `customTypes` arg and writes `exercise_type` (or `null`) per row

**`apps/parakeet/src/modules/settings/hooks/useAuxiliaryPools.ts`:**
- [x] `saveAuxiliaryPool` accepts and forwards a `customTypes` map

**`apps/parakeet/src/modules/jit/lib/jit.ts`:**
- [x] Fetches `getAllAuxTypeMap` alongside `getAllAuxMuscleMap`; populates `JITInput.customExerciseTypeMap` (only when non-empty, to keep replay traces clean)
- [x] Merges `allPools.cardio` into the unified `auxiliaryPool` so cardio entries show up in pickers. Volume top-up still filters them out at `buildVolumeTopUp` (timed entries are removed before scoring), so cardio never gets auto-picked.

**`apps/parakeet/src/shared/ui/AddExerciseModal.tsx`:**
- [x] `defaultLift?: Lift | 'core' | 'cardio'` — pre-selects the section filter
- [x] Adds a "Cardio" filter pill. Cardio filter rule: `associatedLift === null && type === 'timed' && !primaryMuscles.includes('core')`
- [x] `onConfirm` widened to `(name, muscles?, exerciseType?)` — backwards-compatible, optional args
- [x] Custom-exercise flow now branches: `name → type picker → (muscles if not timed)`. The type picker is 3 cards (Weighted / Bodyweight / Timed) each with a one-line description. Timed selections short-circuit straight to confirm with an empty muscle list — timed exercises don't contribute to volume accounting, so asking for muscles would create phantom MRV pressure.

**`apps/parakeet/src/app/settings/auxiliary-exercises.tsx`:**
- [x] `POOL_CATEGORIES` extended to `[squat, bench, deadlift, core, cardio]`
- [x] `LiftSection` tracks `customTypes` alongside `customMuscles`; both passed to `onSavePool` and persisted via `reorderAuxiliaryPool`

**`apps/parakeet/src/app/(tabs)/session/[sessionId].tsx`:**
- [x] `handleConfirmAddExercise` accepts the optional `customType` from the modal and feeds it to `addAdHocSet` instead of round-tripping through `getExerciseType(name)` for unknown names. Suggested weight is only computed for `'weighted'` types — a user-typed "Running" no longer gets a fabricated barbell load.

## Dependencies

- [infra-002-supabase-setup.md](../infra/spec-supabase.md)
- [engine-008-auxiliary-exercise-rotation.md](./spec-rotation.md)
- Design: [auxiliary-exercise-types.md](../../design/auxiliary-exercise-types.md)
