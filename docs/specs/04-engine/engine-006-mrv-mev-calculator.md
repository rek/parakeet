# Spec: MRV/MEV Calculator

**Status**: Planned
**Domain**: Training Engine

## What This Covers

Computes weekly volume per muscle group from completed session logs and compares against each user's MEV (Min Effective Volume) and MRV (Max Recoverable Volume) landmarks. This output is consumed by the JIT session generator to modulate planned sets.

## Tasks

**File: `packages/training-engine/src/volume/mrv-mev-calculator.ts`**

- `computeWeeklyVolume(sessionLogs: CompletedSetLog[], muscleMapper: MuscleMapper): Record<MuscleGroup, number>`
  - Sums completed sets per muscle group for all logs in the current training week
  - Each set counts as 1 unit toward the primary muscle and 0.5 toward secondary muscles (e.g. bench press: chest=primary, triceps=secondary, shoulders=secondary)
  - Returns: `{ quads: 12, hamstrings: 8, chest: 10, triceps: 6, ... }`

- `classifyVolumeStatus(weeklyVolume: Record<MuscleGroup, number>, config: MrvMevConfig): Record<MuscleGroup, VolumeStatus>`
  - `VolumeStatus` enum: `'below_mev' | 'in_range' | 'approaching_mrv' | 'at_mrv' | 'exceeded_mrv'`
  - `approaching_mrv`: within 2 sets of MRV
  - `at_mrv`: exactly at MRV
  - `exceeded_mrv`: above MRV (should not normally happen; disruption)

- `computeRemainingCapacity(weeklyVolume: Record<MuscleGroup, number>, config: MrvMevConfig): Record<MuscleGroup, number>`
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

**Default values (Dr. Mike Israetel's research-backed landmarks):**
```typescript
export const DEFAULT_MRV_MEV_CONFIG: MrvMevConfig = {
  quads:      { mev: 8,  mrv: 20 },
  hamstrings: { mev: 6,  mrv: 20 },
  glutes:     { mev: 0,  mrv: 16 },
  lower_back: { mev: 6,  mrv: 12 },
  upper_back: { mev: 10, mrv: 22 },
  chest:      { mev: 8,  mrv: 22 },
  triceps:    { mev: 6,  mrv: 20 },
  shoulders:  { mev: 8,  mrv: 20 },
  biceps:     { mev: 8,  mrv: 20 },
}
```

**File: `packages/training-engine/src/volume/muscle-mapper.ts`**

- `getMusclesForLift(lift: Lift, exercise?: string): MuscleContribution[]`
  - Returns muscle contributions with `primary: true/false` and `contribution: number` (1.0 or 0.5)

```typescript
// Lift → muscle group mapping
const LIFT_MUSCLES: Record<string, MuscleContribution[]> = {
  squat: [
    { muscle: 'quads',      contribution: 1.0 },
    { muscle: 'glutes',     contribution: 1.0 },
    { muscle: 'hamstrings', contribution: 0.5 },
    { muscle: 'lower_back', contribution: 0.5 },
  ],
  bench: [
    { muscle: 'chest',      contribution: 1.0 },
    { muscle: 'triceps',    contribution: 0.5 },
    { muscle: 'shoulders',  contribution: 0.5 },
  ],
  deadlift: [
    { muscle: 'hamstrings', contribution: 1.0 },
    { muscle: 'glutes',     contribution: 1.0 },
    { muscle: 'lower_back', contribution: 1.0 },
    { muscle: 'upper_back', contribution: 0.5 },
  ],
}
```

**Unit tests (`packages/training-engine/__tests__/mrv-mev-calculator.test.ts`):**
- 3 squat sessions × 5 sets = 15 quad sets → quads: 15 (approaching_mrv at MRV=20)
- 2 bench sessions × 3 sets = 6 chest sets + 3 tricep secondary sets (= 3 × 0.5 = 1.5 → floor to 1) → check triceps: 1
- `computeRemainingCapacity`: 18 quad sets logged, MRV=20 → remaining: 2
- `classifyVolumeStatus`: 12 quad sets (MEV=8, MRV=20) → `'in_range'`
- `classifyVolumeStatus`: 19 quad sets → `'approaching_mrv'`
- `classifyVolumeStatus`: 20 quad sets → `'at_mrv'`

## Dependencies

- [engine-002-cube-method-scheduler.md](./engine-002-cube-method-scheduler.md)
- [data-001-muscle-volume-config.md](../05-data/data-001-muscle-volume-config.md)
