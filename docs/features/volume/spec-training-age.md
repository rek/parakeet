# Spec: Training-Age-Scaled MRV/MEV

**Status**: Implemented

**Domain**: Training Engine

## What This Covers

Adds a training-age multiplier to MRV/MEV volume defaults so beginners get lower volume ceilings and advanced lifters get higher ones. Wired into the simulation to validate with all 14 scenarios.

## Tasks

**`packages/training-engine/src/volume/mrv-mev-calculator.ts`:**

- [x] `TrainingAge` type — `'beginner' | 'intermediate' | 'advanced'`
- [x] `TRAINING_AGE_MULTIPLIERS` constant — beginner (mev 1.0, mrv 0.8), intermediate (1.0, 1.0), advanced (1.1, 1.2)
- [x] `applyTrainingAgeMultiplier({ config, trainingAge })` — maps over `MUSCLE_GROUPS`, multiplies mev/mrv, rounds to integers
- [x] Tests in `mrv-mev-calculator.test.ts`:
  - Beginner scales MRV down, keeps MEV
  - Intermediate unchanged
  - Advanced scales both up
  - Female defaults
  - Integer rounding

**`packages/training-sim/src/simulator.ts`:**

- [x] Import `applyTrainingAgeMultiplier` from `@parakeet/training-engine`
- [x] Apply between sex-based defaults and persona overrides (overrides take precedence)

## Domain References

- [domain/volume-landmarks.md](../../domain/volume-landmarks.md) — training age multiplier table and research basis

## Dependencies

- None — extends existing MRV/MEV calculator
