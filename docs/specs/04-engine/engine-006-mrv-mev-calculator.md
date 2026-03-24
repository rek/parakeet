# Spec: MRV/MEV Calculator

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

Computes weekly volume per muscle group from completed session logs and compares against each user's MEV (Min Effective Volume) and MRV (Max Recoverable Volume) landmarks. This output is consumed by the JIT session generator to modulate planned sets.

## Tasks

**File: `packages/training-engine/src/volume/mrv-mev-calculator.ts`**

- [x] `computeWeeklyVolume(sessionLogs: CompletedSetLog[], muscleMapper: MuscleMapper): Record<MuscleGroup, number>`
  - Sums completed sets per muscle group for all logs in the current training week
  - Each set counts as 1 unit toward the primary muscle and 0.5 toward secondary muscles
  - Returns: `{ quads: 12, hamstrings: 8, chest: 10, triceps: 6, ... }`
- [x] `classifyVolumeStatus(weeklyVolume: Record<MuscleGroup, number>, config: MrvMevConfig): Record<MuscleGroup, VolumeStatus>`
  - `VolumeStatus` enum: `'below_mev' | 'in_range' | 'approaching_mrv' | 'at_mrv' | 'exceeded_mrv'`
  - `approaching_mrv`: within 2 sets of MRV
  - `at_mrv`: exactly at MRV
  - `exceeded_mrv`: above MRV (should not normally happen; disruption)
- [x] `computeRemainingCapacity(weeklyVolume: Record<MuscleGroup, number>, config: MrvMevConfig): Record<MuscleGroup, number>`
  - Returns sets remaining before hitting MRV per muscle group
  - Negative value means MRV is exceeded

**Type: `MrvMevConfig`**
```typescript
interface MrvMevConfig {
  [muscle: MuscleGroup]: {
    mev: number   // minimum effective volume (sets/week)
    mrv: number   // maximum recoverable volume (sets/week)
  }
}
```

See [domain/volume-landmarks.md](../../domain/volume-landmarks.md) for `DEFAULT_MRV_MEV_CONFIG` values (male and female MEV/MRV per muscle group).

**File: `packages/training-engine/src/volume/muscle-mapper.ts`**

- [x] `getMusclesForLift(lift: Lift, exercise?: string): MuscleContribution[]`
  - Returns muscle contributions with `primary: true/false` and `contribution: number` (1.0 or 0.5)

See [domain/muscle-mapping.md](../../domain/muscle-mapping.md) for the `LIFT_MUSCLES` contribution table (primary and secondary contributions per lift).

**Unit tests (`packages/training-engine/__tests__/mrv-mev-calculator.test.ts`):**
- [x] 3 squat sessions × 5 sets = 15 quad sets → quads: 15 (approaching_mrv at MRV=20)
- [x] 2 bench sessions × 3 sets = 6 chest sets + 3 tricep secondary sets (= 3 × 0.5 = 1.5 → floor to 1) → check triceps: 1
- [x] `computeRemainingCapacity`: 18 quad sets logged, MRV=20 → remaining: 2
- [x] `classifyVolumeStatus`: 12 quad sets (MEV=8, MRV=20) → `'in_range'`
- [x] `classifyVolumeStatus`: 19 quad sets → `'approaching_mrv'`
- [x] `classifyVolumeStatus`: 20 quad sets → `'at_mrv'`

## Dependencies

- [engine-002-cube-method-scheduler.md](./engine-002-cube-method-scheduler.md)
- [data-001-muscle-volume-config.md](../05-data/data-001-muscle-volume-config.md)

## Domain References

- [domain/volume-landmarks.md](../../domain/volume-landmarks.md) — MEV/MRV defaults per muscle group, male and female
- [domain/muscle-mapping.md](../../domain/muscle-mapping.md) — lift-to-muscle contribution table
