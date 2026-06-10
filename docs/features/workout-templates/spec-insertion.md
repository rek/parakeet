# Spec: Workout Templates — Insertion Flow + Rest Timer Wiring

**Status**: Implemented

**Domain**: UI (session) + Session store + Rest timer

## What This Covers

The lifter-facing path: a new "+ Add Workout" button on the session screen,
a modal that lists global templates, the expansion logic that turns a
template into N flat `AuxiliaryActualSet` entries, the rest-timer wiring
that honours `prescribed_rest_seconds` over the user's global default, and
the cleanup needed to thread the new entries into the existing session
renderer.

## Tasks

**`apps/parakeet/src/modules/session/ui/AddWorkoutTemplateModal.tsx`:**

- [x] New modal listing all templates from `useWorkoutTemplates()` with name, description, item × round summary
      → `apps/parakeet/src/modules/session/ui/AddWorkoutTemplateModal.tsx:AddWorkoutTemplateModal`
- [x] On tap: `queryClient.fetchQuery(workoutTemplatesQueries.detail(id))`, then `onConfirm(detail)` so the screen receives the fully-resolved template + items in one go (no separate fetch in the screen)

**`apps/parakeet/src/modules/session/utils/expandTemplate.ts`:**

- [x] Pure `expandTemplate(template, items)` — round-by-round flat sequence with shared `template_instance_id`
      → `apps/parakeet/src/modules/session/utils/expandTemplate.ts:expandTemplate`
- [x] Unit tests — ordering, instance-id sharing, prescribed rest threading, timed vs weighted reps default, position sort
      → `apps/parakeet/src/modules/session/utils/expandTemplate.test.ts`

**`apps/parakeet/src/modules/session/utils/resolveAuxRestSeconds.ts`:**

- [x] Helper: prefer set's `prescribed_rest_seconds`, else `fallback`
      → `apps/parakeet/src/modules/session/utils/resolveAuxRestSeconds.ts:resolveAuxRestSeconds`
- [x] Unit tests — prescribed wins, fallback when null, fallback when no match
      → `apps/parakeet/src/modules/session/utils/resolveAuxRestSeconds.test.ts`

**`apps/parakeet/src/app/(tabs)/session/[sessionId].tsx`:**

- [x] "+ Add Workout" button next to existing "+ Add Exercise"
- [x] `addWorkoutVisible` state + `AddWorkoutTemplateModal` render
- [x] `handleConfirmAddWorkout` — expands + calls `addTemplateBlock`, merges template exercises into `adHocExercises` so the existing aux renderer picks them up

**`apps/parakeet/src/modules/session/hooks/useSetCompletionFlow.ts`:**

- [x] All four `openTimer` aux-rest spots now use `resolveAuxRestSeconds` with the prior recommendation/default as fallback. Template-derived sets honour their per-item rest; everything else behaves exactly as before.

## Polish landed

- [x] Round-by-round visual interleaving via `AuxTemplateBlock` — entries render in expansion order (`Bike#1 → Ski#1 → Row#1 → Bike#2 → …`) with a `Round X/Y` badge per entry, framed by the template name header. Template-tagged sets are filtered out of the per-exercise `adHocExercises` renderer so they only appear once.
      → `apps/parakeet/src/modules/session/ui/AuxTemplateBlock.tsx:AuxTemplateBlock`
- [x] Bulk-remove: ✕ button in the block header opens a confirm dialog, then calls `removeTemplateBlock(template_instance_id)` which drops all tagged entries and renumbers remaining sets per exercise contiguously.
- [x] Weight auto-suggest via `expandTemplate`'s `computeWeightGrams` option. The session screen passes `computeSuggestedWeight(name, oneRmGrams, catalog)` so weighted template entries get a sensible starting weight (mirrors the ad-hoc add flow).
      → `apps/parakeet/src/modules/session/utils/expandTemplate.ts:ExpandTemplateOptions`

## Tests

- `expandTemplate.test.ts` — 6 tests (ordering, instance-id sharing, prescribed rest threading, timed vs weighted reps, position sort, computeWeightGrams)
- `resolveAuxRestSeconds.test.ts` — 3 tests
- `sessionStore.test.ts` — 6 new tests covering `addTemplateBlock` (numbering from empty, continuation, prescribed-rest preservation) and `removeTemplateBlock` (drop by instance, renumber affected exercises, no-op on unknown id)

## Dependencies

- [spec-schema.md](./spec-schema.md) — needs AuxiliaryActualSet extension + hooks
- [spec-management.md](./spec-management.md) — needed for the library to be non-empty (not a hard build dependency)
