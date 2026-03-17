# Spec: OHP Lifter Maxes Migration

**Status**: Planned

**Domain**: Data

## What This Covers

Adds OHP columns to the `lifter_maxes` table and updates the `warmup_configs` lift check constraint. The `sessions.primary_lift` and `auxiliary_exercises.lift` constraints already include `overhead_press` (migration 20260315).

## Tasks

**New migration `supabase/migrations/20260317000000_add_ohp_lifter_maxes.sql`:**

- [ ] Add nullable columns to `lifter_maxes`:
  - `overhead_press_1rm_grams INTEGER`
  - `overhead_press_input_grams INTEGER`
  - `overhead_press_input_reps INTEGER`
- [ ] Update `warmup_configs` lift check constraint to include `'overhead_press'`:
  - `ALTER TABLE warmup_configs DROP CONSTRAINT IF EXISTS warmup_configs_lift_check;`
  - `ALTER TABLE warmup_configs ADD CONSTRAINT warmup_configs_lift_check CHECK (lift = ANY (ARRAY['squat','bench','deadlift','overhead_press']));`

**`supabase/types.ts`:**

- [ ] Hand-edit `lifter_maxes` Row type: add `overhead_press_1rm_grams: number | null`, `overhead_press_input_grams: number | null`, `overhead_press_input_reps: number | null`
- [ ] Hand-edit `lifter_maxes` Insert type: same fields, optional
- [ ] Hand-edit `lifter_maxes` Update type: same fields, optional

## Notes

- All OHP columns are nullable — existing rows (from 3-lift programs) will have NULL for these columns
- `getCurrentOneRmKg('overhead_press')` reads `overhead_press_1rm_grams` via template string — returns null for rows without OHP data, triggering fallback to `estimateOneRmKgFromProfile`
- Re-run `npm run db:types` after applying migration if local Supabase is running; otherwise hand-edit

## Dependencies

- None — can be implemented independently (DB migration has no code dependencies)
