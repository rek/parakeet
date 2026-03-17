# Spec: OHP Muscle Mapping

**Status**: Planned

**Domain**: Training Engine

## What This Covers

Adds OHP to the primary lift muscle mapping so volume tracking correctly attributes OHP sets to shoulder, tricep, and upper back volume.

## Tasks

**`packages/training-engine/src/volume/muscle-mapper.ts`:**

- [ ] Add `overhead_press` entry to `LIFT_MUSCLES`:
  ```
  overhead_press: [
    { muscle: 'shoulders', contribution: 1.0 },
    { muscle: 'triceps', contribution: 0.4 },
    { muscle: 'upper_back', contribution: 0.5 },
  ]
  ```

**Tests (`packages/training-engine/src/volume/muscle-mapper.test.ts`):**

- [ ] Test `getMusclesForLift('overhead_press')` returns correct contributions
- [ ] Verify shoulders at 1.0, triceps at 0.4, upper back at 0.5

## Notes

- Contribution values calibrated to RP Strength volume landmarks, consistent with existing entries
- `EXERCISE_MUSCLES['Overhead Press']` already exists in the catalog with (shoulders 1.0, triceps 1.0, upper_back 0.5) — `LIFT_MUSCLES` uses lower triceps contribution (0.4) since the primary lift volume accounting is separate from exercise-level contributions

## Dependencies

- types-003 (Lift enum must include `'overhead_press'`)
