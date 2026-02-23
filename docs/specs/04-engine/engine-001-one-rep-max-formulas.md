# Spec: One-Rep Max Estimation Formulas

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

1RM estimation in kilograms. Used during onboarding (3RM → 1RM conversion) and for estimating current 1RM from session log data.

## Tasks

**File: `packages/training-engine/src/formulas/one-rep-max.ts`**

- `estimateOneRepMax_Epley(weightKg: number, reps: number): number`
  - Formula: `weightKg × (1 + reps / 30)`
  - Returns `weightKg` unchanged when `reps === 1`
  - Throws `InvalidInputError` when `weightKg <= 0` or `reps <= 0` or `reps > 20`

- `estimateOneRepMax_Brzycki(weightKg: number, reps: number): number`
  - Formula: `weightKg / (1.0278 - 0.0278 × reps)`
  - Same guards as Epley

- `estimateOneRepMax(weightKg: number, reps: number, formula?: '1rm_epley' | '1rm_brzycki'): number`
  - Default: `'1rm_epley'`

**File: `packages/training-engine/src/formulas/weight-rounding.ts`**

- `roundToNearest(weightKg: number, incrementKg?: number): number`
  - Default increment: 2.5 (nearest 2.5kg — standard barbell plate increment)
  - `Math.round(weightKg / incrementKg) * incrementKg`
  - Example: 113.3kg → 112.5kg (nearest 2.5)

- `gramsToKg(grams: number): number` — `grams / 1000`
- `kgToGrams(kg: number): number` — `Math.round(kg * 1000)` (integer grams)

**Unit tests (`packages/training-engine/__tests__/one-rep-max.test.ts`):**
- `estimateOneRepMax_Epley(130, 3)` → 143kg (Epley gives 130 × (1 + 3/30) = 143)
- `estimateOneRepMax_Epley(100, 1)` → 100 (unchanged at 1 rep)
- `estimateOneRepMax_Epley(-5, 3)` → throws `InvalidInputError`
- `roundToNearest(113.3)` → 112.5
- `roundToNearest(114.0)` → 115.0
- `gramsToKg(140000)` → 140.0
- `kgToGrams(112.5)` → 112500

## Dependencies

- [infra-001-nx-monorepo-setup.md](../01-infra/infra-001-nx-monorepo-setup.md)

## References

- ADR: [005-training-engine-package.md](../decisions/005-training-engine-package.md)
