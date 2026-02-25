# Spec: WILKS Formula (2020)

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

WILKS score calculation using the 2020 updated coefficients. Normalises total lifted weight (kg) for bodyweight and sex, enabling strength comparisons across weight classes and across cycles. Used in cycle review summaries and history trend views.

## Tasks

**File: `packages/training-engine/src/formulas/wilks.ts`**

- [ ] Export `WilksSex` type: `'male' | 'female'`
- [ ] Define `COEFFICIENTS` constant with 2020 Wilks formula coefficients for both sexes
- [ ] `computeWilks2020(totalKg: number, bodyweightKg: number, sex: WilksSex): number`
  - Formula: `coefficient = 600 / (a + b*bw + c*bw² + d*bw³ + e*bw⁴ + f*bw⁵)`, then `wilks = totalKg × coefficient`
  - Clamp bodyweight to valid range (female 40–150 kg, male 40–200 kg) before calculation — do not throw, just clamp
  - Return `0` if `totalKg <= 0`
  - Round result to 2 decimal places

**Unit tests (`packages/training-engine/__tests__/wilks.test.ts`):**
- [ ] Known female reference: 60kg BW, 400kg total → ~371 points (tolerance ±2)
- [ ] Known male reference: 83kg BW, 600kg total → ~378 points (tolerance ±2)
- [ ] `computeWilks2020(0, 75, 'male')` → 0
- [ ] Bodyweight below 40kg → clamped to 40kg, result non-zero
- [ ] Returns a higher score for a lighter lifter with the same total (sex = male, compare 70kg vs 90kg)

**Export from `packages/training-engine/src/index.ts`:**
- [ ] Add exports:
  ```typescript
  export { computeWilks2020 } from './formulas/wilks'
  export type { WilksSex } from './formulas/wilks'
  ```

## Usage Context

- Cycle review screen (`history/cycle-review/[programId].tsx`): shows WILKS change from start → end of cycle
  - Requires `bodyweightKg` and `biologicalSex` from user profile; `totalKg` from 1RM estimates at cycle start/end
- History screen: all-time WILKS trend chart (future)
- `prefer_not_to_say` → use `'male'` coefficients (conservative; affects score magnitude but not trend direction)

## Dependencies

- [data-004-athlete-profile.md](../05-data/data-004-athlete-profile.md) — `biological_sex` and body weight
- [engine-012-cycle-review-generator.md](./engine-012-cycle-review-generator.md) — consumes WILKS in review output
