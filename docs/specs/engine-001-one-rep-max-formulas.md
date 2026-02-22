# Spec: One-Rep Max Estimation Formulas

**Status**: Planned
**Domain**: Training Engine

## What This Covers

Implement 1RM estimation formulas in `packages/training-engine`. These are used during onboarding (3RM → 1RM conversion) and for estimating current 1RM from performance log data.

## Tasks

**File: `packages/training-engine/src/formulas/one-rep-max.ts`**

- `estimateOneRepMax_Epley(weight: number, reps: number): number`
  - Formula: `weight × (1 + reps / 30)`
  - Return `weight` unchanged when `reps === 1`
  - Throw `InvalidInputError` when `weight <= 0` or `reps <= 0` or `reps > 20`

- `estimateOneRepMax_Brzycki(weight: number, reps: number): number`
  - Formula: `weight / (1.0278 - 0.0278 × reps)`
  - Same guards as Epley

- `estimateOneRepMax(weight: number, reps: number, formula: '1rm_epley' | '1rm_brzycki'): number`
  - Dispatcher that calls the correct formula
  - Default: `'1rm_epley'`

**File: `packages/training-engine/src/formulas/weight-rounding.ts`**

- `roundToNearest(weight: number, increment: number): number`
  - `Math.round(weight / increment) * increment`
  - Default increment: 2.5

**Unit tests (`packages/training-engine/__tests__/one-rep-max.test.ts`):**
- Known values: 285 lbs × 3 → Epley = 313.5 lbs
- Edge cases: reps=1 returns weight unchanged
- Error cases: negative weight throws
- Rounding: 313.2 → 312.5 at 2.5 increment

## Dependencies

- [infra-001-nx-monorepo-setup.md](./infra-001-nx-monorepo-setup.md)

## References

- ADR: [005-training-engine-package.md](../decisions/005-training-engine-package.md)
