# Spec: OHP Auxiliary Exercise Catalog

**Status**: Planned

**Domain**: Training Engine

## What This Covers

Adds OHP-specific auxiliary exercises to the exercise catalog and builds the OHP auxiliary pool. Reassigns existing exercises that are more OHP-aligned (Push Press) from bench to OHP.

## Tasks

**`packages/training-engine/src/auxiliary/exercise-catalog.ts`:**

- [ ] Add OHP auxiliary exercises to `EXERCISE_CATALOG`:
  - Dumbbell Shoulder Press — `associatedLift: 'overhead_press'`, primaryMuscles: `['shoulders', 'triceps']`, weightPct: 0.30, repTarget: 10
  - Arnold Press — `associatedLift: 'overhead_press'`, primaryMuscles: `['shoulders', 'triceps']`, weightPct: 0.25, repTarget: 10
  - Z Press — `associatedLift: 'overhead_press'`, primaryMuscles: `['shoulders', 'upper_back']`, weightPct: 0.65, repTarget: 6
  - Lateral Raise — `associatedLift: 'overhead_press'`, primaryMuscles: `['shoulders']`, weightPct: 0.08, repTarget: 12
  - Behind-the-Neck Press — `associatedLift: 'overhead_press'`, primaryMuscles: `['shoulders', 'triceps']`, weightPct: 0.70, repTarget: 6
  - Seated Barbell OHP — `associatedLift: 'overhead_press'`, primaryMuscles: `['shoulders', 'triceps']`, weightPct: 0.85, repTarget: 6
- [ ] Change existing "Overhead Press" entry from `associatedLift: null` to `associatedLift: 'overhead_press'`
- [ ] Change existing "Barbell Push Press" from `associatedLift: 'bench'` to `associatedLift: 'overhead_press'`
- [ ] Add `overhead_press` entry to `DEFAULT_AUXILIARY_POOLS` (derived from catalog filter)
- [ ] Add `overhead_press` entry to `SQRT_REFERENCE_1RM`: `{ male: 60, female: 35 }`

**Tests:**

- [ ] Verify `DEFAULT_AUXILIARY_POOLS.overhead_press` is non-empty
- [ ] Verify `SQRT_REFERENCE_1RM.overhead_press` values

## Notes

- Dumbbell/kettlebell exercises use sqrt scaling via `computeAuxWeight()` — no change needed there
- Pike Push-ups could gain an additional bodyweight pool entry for OHP but this is optional

## Dependencies

- engine-036 (`LIFTS` must include `'overhead_press'`)
