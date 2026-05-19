# Spec: Workout Templates — Management UI

**Status**: Implemented

**Domain**: UI (settings)

## What This Covers

Settings list + edit screens for the global template library. CRUD wired
to the `modules/workout-templates/` hooks built in [spec-schema.md](./spec-schema.md).

Note: in implementation, the bulk of UI logic lives in module-owned
components (`WorkoutTemplatesList`, `WorkoutTemplateEditor`); the route
files are thin wrappers per project convention.

## Tasks

**`apps/parakeet/src/modules/workout-templates/ui/WorkoutTemplatesList.tsx`:**

- [x] List screen — all templates (name, description, item count × rounds)
  → `apps/parakeet/src/modules/workout-templates/ui/WorkoutTemplatesList.tsx:WorkoutTemplatesList`
- [x] Tap row → push edit screen at `[id]`
- [x] "+ New Template" button → push edit screen with `id=new`
- [x] Empty state copy

**`apps/parakeet/src/modules/workout-templates/ui/WorkoutTemplateEditor.tsx`:**

- [x] Edit screen — name, description, rounds inputs
  → `apps/parakeet/src/modules/workout-templates/ui/WorkoutTemplateEditor.tsx:WorkoutTemplateEditor`
- [x] Hydrate local state from query when editing existing
- [x] Ordered item list with reorder (↑/↓) + remove
- [x] "+ Add Exercise" → opens shared `AddExerciseModal` for catalog picking
- [x] Per-item editor row (duration_seconds for timed, reps otherwise; rest_after_seconds always)
  → `apps/parakeet/src/modules/workout-templates/ui/WorkoutTemplateItemRow.tsx:WorkoutTemplateItemRow`
- [x] Save button — create or update + replace items, navigate back / to new id
- [x] Delete button (edit mode only) with confirm dialog
- [x] captureException + Alert on save/delete failure

**`apps/parakeet/src/modules/workout-templates/utils/template-item-defaults.ts`:**

- [x] `defaultItemForExercise(exercise, position)` — sensible starting prescription based on catalog type
  → `apps/parakeet/src/modules/workout-templates/utils/template-item-defaults.ts:defaultItemForExercise`

**`apps/parakeet/src/app/settings/workout-templates/index.tsx`:**

- [x] Thin route wrapping `WorkoutTemplatesList`

**`apps/parakeet/src/app/settings/workout-templates/[id].tsx`:**

- [x] Thin route wrapping `WorkoutTemplateEditor`

**`apps/parakeet/src/app/(tabs)/settings.tsx`:**

- [x] "Workout Templates" row pointing to `/settings/workout-templates`

**Refactor (boundaries-driven):**

- [x] `AddExerciseModal` moved from `modules/session/ui/` to `shared/ui/` so both
  the session screen and the workout-templates editor can use it without a
  module dependency cycle
  → `apps/parakeet/src/shared/ui/AddExerciseModal.tsx`

## Dependencies

- [spec-schema.md](./spec-schema.md) — needs the hooks + module skeleton
