# Spec: OHP UI Across Screens

**Status**: Planned

**Domain**: Mobile

## What This Covers

Updates all UI screens that hardcode 3-lift arrays or need OHP-specific display (colors, labels, filters). Also adds OHP color to the palette.

## Tasks

### Theme

**`apps/parakeet/src/theme/index.ts`:**

- [ ] Add purple/violet palette entries for OHP: `purple400`, `purple500` (or similar)

### History

**`apps/parakeet/src/app/(tabs)/history.tsx`:**

- [ ] Add `overhead_press` to `LIFT_COLORS` (purple)
- [ ] Replace `(['squat', 'bench', 'deadlift'] as Lift[]).map(...)` with `TRAINING_LIFTS.map(...)`
- [ ] Replace `(['all', 'squat', 'bench', 'deadlift'] as LiftFilter[])` with `['all', ...TRAINING_LIFTS]`

**`apps/parakeet/src/app/history/lift/[lift].tsx`:**

- [ ] Add `overhead_press` to `LIFT_COLORS`

**`apps/parakeet/src/app/history/cycle-review/[programId].tsx`:**

- [ ] Replace `(['squat', 'bench', 'deadlift'] as string[])` with `TRAINING_LIFTS`

**`apps/parakeet/src/modules/history/utils/chart-helpers.ts`:**

- [ ] Replace `(['squat', 'bench', 'deadlift'] as Lift[])` with `[...TRAINING_LIFTS]`

### Achievements

**`apps/parakeet/src/modules/achievements/ui/AchievementsSection.tsx`:**

- [ ] Replace `(['squat', 'bench', 'deadlift'] as const).map(...)` with `TRAINING_LIFTS.map(...)`

### Session

**`apps/parakeet/src/modules/session/ui/AddExerciseModal.tsx`:**

- [ ] Add `'overhead_press'` to filter options list
- [ ] Add `overhead_press: 'OHP'` to `SECTION_LABELS`

**`apps/parakeet/src/app/(tabs)/session/adhoc.tsx`:**

- [ ] Add OHP to lift picker options

### Settings

**`apps/parakeet/src/app/settings/warmup-protocol.tsx`:**

- [ ] Add `overhead_press: 'OHP'` to local `LIFT_LABELS`

**`apps/parakeet/src/app/settings/auxiliary-exercises.tsx`:**

- [ ] Add `overhead_press: 'OHP'` to local `LIFT_LABELS`

**`apps/parakeet/src/app/settings/aux-block-assignments.tsx`:**

- [ ] Add `overhead_press: 'OHP'` to local `LIFT_LABELS`

### Simulation

**`packages/training-sim/src/simulator.ts`:**

- [ ] Add optional `ohpMaxKg` to persona type with fallback `benchMaxKg * 0.65`
- [ ] Replace hardcoded `['squat', 'bench', 'deadlift']` loop with `LIFTS`

**`packages/training-sim/src/reporter.ts`:**

- [ ] Add OHP to 1RM progression display loop

**Persona files:**

- [ ] Add `ohpMaxKg` to each persona definition

### Test Fixtures

**`packages/training-engine/src/generator/jit-invariants.test.ts`:**

- [ ] Add `'overhead_press'` to local `LIFTS` array

**`packages/training-engine/src/sessions/makeup-window.test.ts`:**

- [ ] Add `'overhead_press'` to lift union

## Notes

- Settings screens iterate `TRAINING_LIFTS` which re-exports `LIFTS` — once engine-036 expands LIFTS, these screens automatically show 4 lifts. The local `LIFT_LABELS` just needs the new key.
- Settings screens will show OHP for all users (including 3-day). This is acceptable — unused settings are harmless.
- Wilks score stays 3-lift total (traditional powerlifting) — no OHP in Wilks calculation.

## Dependencies

- types-003 (Lift enum)
- engine-036 (LIFTS array)
- mobile-043 (app constants with LIFT_LABELS)
