# Spec: One-Rep Max Estimation Formulas

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

1RM estimation in kilograms. Used during onboarding (3RM → 1RM conversion) and for estimating current 1RM from session log data.

## Tasks

**File: `packages/training-engine/src/formulas/one-rep-max.ts`**

- [x] `estimateOneRepMax_Epley(weightKg: number, reps: number): number`
  - Formula: `weightKg × (1 + reps / 30)`
  - Returns `weightKg` unchanged when `reps === 1`
  - Throws `InvalidInputError` when `weightKg <= 0` or `reps <= 0` or `reps > 20`
- [x] `estimateOneRepMax_Brzycki(weightKg: number, reps: number): number`
  - Formula: `weightKg / (1.0278 - 0.0278 × reps)`
  - Same guards as Epley
- [x] `estimateOneRepMax(weightKg: number, reps: number, formula?: '1rm_epley' | '1rm_brzycki'): number`
  - Default: `'1rm_epley'`

**File: `packages/training-engine/src/formulas/weight-rounding.ts`**

- [x] `roundToNearest(weightKg: number, incrementKg?: number): number`
  - Default increment: 2.5 (nearest 2.5kg — standard barbell plate increment)
  - `Math.round(weightKg / incrementKg) * incrementKg`
  - Example: 113.3kg → 112.5kg (nearest 2.5)
- [x] `gramsToKg(grams: number): number` — `grams / 1000`
- [x] `kgToGrams(kg: number): number` — `Math.round(kg * 1000)` (integer grams)

**Unit tests (`packages/training-engine/__tests__/one-rep-max.test.ts`):**

- [x] `estimateOneRepMax_Epley(130, 3)` → 143kg (Epley gives 130 × (1 + 3/30) = 143)
- [x] `estimateOneRepMax_Epley(100, 1)` → 100 (unchanged at 1 rep)
- [x] `estimateOneRepMax_Epley(-5, 3)` → throws `InvalidInputError`
- [x] `roundToNearest(113.3)` → 112.5
- [x] `roundToNearest(114.0)` → 115.0
- [x] `gramsToKg(140000)` → 140.0
- [x] `kgToGrams(112.5)` → 112500

## Open Issues (2026-05 review)

- [x] (landed) **Novice estimation is inflated and unsafe for first-session prescription.** `estimateOneRmKgFromProfile` returns `bodyweight × 1.05` for an untrained female squat. A 22-year-old 70 kg untrained woman gets squat 1RM ≈ 73.5 kg → week-1 heavy prescription of 70–80% × workingOneRm ≈ 51–58 kg, which can be a 1RM attempt every set. Either prompt for a self-rated training level during onboarding and multiply by ~0.6 for novice, or cap the first session at ≤ 50% e1RM until 2–3 sessions of RPE-anchored data exist (`computeWorkingOneRm` switches `source` to `'working'`).
- [ ] **`max-estimation.ts:66` defaults `biologicalSex` to `'male'` when undefined.** A pre-onboarding female account gets male-estimated 1RMs at first sign-in. Once she sets her sex in onboarding, the persisted `1rm_kg` is not re-estimated. Either invalidate / re-estimate when `biological_sex` changes from undefined to a known value, or refuse estimation until sex is set.

## Dependencies

- [infra-001-nx-monorepo-setup.md](../infra/spec-monorepo.md)

## References

- ADR: [005-training-engine-package.md](../decisions/005-training-engine-package.md)
