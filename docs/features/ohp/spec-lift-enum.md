# Spec: Add `overhead_press` to Lift Enum

**Status**: Planned

**Domain**: Shared Types

## What This Covers

Adds `'overhead_press'` to the `Lift` type union so OHP can be a first-class primary lift. This is the foundational change — all downstream `Record<Lift, ...>` maps will require an OHP entry once this lands.

## Tasks

**`packages/shared-types/src/program.schema.ts`:**

- [ ] Add `'overhead_press'` to `LiftSchema` enum → `z.enum(['squat', 'bench', 'deadlift', 'overhead_press'])`

**`packages/shared-types/src/disruption.schema.ts`:**

- [ ] Add `'overhead_press'` to `affected_lifts` inline enum

**`packages/shared-types/src/formula.schema.ts`:**

- [ ] Add `overhead_press_min: z.number().positive().optional()` to `training_max_increase` in `FormulaOverridesSchema`
- [ ] Add `overhead_press_max: z.number().positive().optional()` to `training_max_increase` in `FormulaOverridesSchema`

**`packages/shared-types/src/lifter-maxes.schema.ts`:**

- [ ] Add `overhead_press: LiftInputSchema.optional()` to `LifterMaxesInputSchema`
- [ ] Add `overhead_press_kg: z.number().positive().optional()` to `LifterMaxesResponseSchema.calculated_1rm`

## Notes

- OHP fields are optional in both `LifterMaxesInputSchema` and `LifterMaxesResponseSchema` because 3-day programs don't use OHP
- Adding `'overhead_press'` to `LiftSchema` will cause TypeScript errors in every incomplete `Record<Lift, ...>` — this is intentional and guides the remaining work

## Dependencies

- None — this is the first spec to implement
