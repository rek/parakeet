# Spec: Workout Templates — Schema + Data Layer

**Status**: Implemented

**Domain**: Data / User Config + Session store

## What This Covers

Migration for the two new tables, regeneration of `supabase/types.ts`,
extension of the in-session zustand `AuxiliaryActualSet` shape to carry
per-item rest + template grouping, and the `modules/workout-templates/`
data layer (queries + mutations + Zod codecs).

## Tasks

**`supabase/migrations/20260519000000_create_workout_templates.sql`:**

- [x] `workout_templates` table — id, name, description, rounds, created_by/updated_by FKs to `auth.users`, created_at/updated_at
  → `supabase/migrations/20260519000000_create_workout_templates.sql`
- [x] `workout_template_items` table — id, template_id FK CASCADE, position, exercise, duration_seconds, reps, rest_after_seconds, `unique (template_id, position)`
  → `supabase/migrations/20260519000000_create_workout_templates.sql`
- [x] RLS: SELECT/INSERT/UPDATE/DELETE policies for `authenticated`. `created_by`/`updated_by` defaulted from `auth.uid()` on insert via column default; updated_by reassigned on update via trigger.
  → `supabase/migrations/20260519000000_create_workout_templates.sql:workout_templates_touch_updated`
- [x] `updated_at` bump trigger on both tables
  → `supabase/migrations/20260519000000_create_workout_templates.sql:workout_templates_touch_updated_trigger`
- [x] Explicit Data API grants to `anon` / `authenticated` / `service_role`
- [x] `NOTIFY pgrst, 'reload schema';`

**`supabase/types.ts`:**

- [x] Regenerated via `npm run db:types` after migration applied locally

**`apps/parakeet/src/modules/session/store/sessionStore.ts`:**

- [x] Extend `AuxiliaryActualSet` with `prescribed_rest_seconds` + `template_instance_id`
  → `apps/parakeet/src/modules/session/store/sessionStore.ts:AuxiliaryActualSet`
- [x] New action: `addTemplateBlock`
  → `apps/parakeet/src/modules/session/store/sessionStore.ts:addTemplateBlock`
- [x] New action: `removeTemplateBlock` (exposed; UI binding deferred — see spec-insertion.md)
  → `apps/parakeet/src/modules/session/store/sessionStore.ts:removeTemplateBlock`
- [x] Persistence: zustand `persist` middleware auto-serializes the new optional fields

**`apps/parakeet/src/modules/workout-templates/data/workout-templates.repository.ts`:**

- [x] `fetchWorkoutTemplates` — list with item counts
  → `apps/parakeet/src/modules/workout-templates/data/workout-templates.repository.ts:fetchWorkoutTemplates`
- [x] `fetchWorkoutTemplateDetail` — single template + items in position order
  → `apps/parakeet/src/modules/workout-templates/data/workout-templates.repository.ts:fetchWorkoutTemplateDetail`
- [x] `insertWorkoutTemplate` / `updateWorkoutTemplate` / `deleteWorkoutTemplate`
- [x] `replaceWorkoutTemplateItems` — delete + insert (templates own their items)

**`apps/parakeet/src/modules/workout-templates/data/workout-templates.queries.ts`:**

- [x] `workoutTemplatesQueries.list()` + `.detail(id)` factories
  → `apps/parakeet/src/modules/workout-templates/data/workout-templates.queries.ts:workoutTemplatesQueries`

**`apps/parakeet/src/modules/workout-templates/hooks/`:**

- [x] `useWorkoutTemplates`, `useCreateWorkoutTemplate`, `useDeleteWorkoutTemplate`
  → `apps/parakeet/src/modules/workout-templates/hooks/useWorkoutTemplates.ts`
- [x] `useWorkoutTemplate`, `useUpdateWorkoutTemplate`, `useReplaceWorkoutTemplateItems`
  → `apps/parakeet/src/modules/workout-templates/hooks/useWorkoutTemplate.ts`

**`apps/parakeet/src/modules/workout-templates/index.ts`:**

- [x] Public API exports — hooks, types, queries factory, UI components

## Dependencies

None — this is Phase 1, the foundation.
