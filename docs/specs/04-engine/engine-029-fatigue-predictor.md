# Spec: Fatigue Predictor & Mismatch Detection

**Status**: Draft
**Domain**: Training Engine

## What This Covers

Two pure functions for the end-of-week body review: one that predicts expected soreness from training volume, and one that detects mismatches between predicted and felt soreness.

## Tasks

### computePredictedFatigue

**File: `packages/training-engine/src/volume/fatigue-predictor.ts`**

```typescript
import { MrvMevConfig, MuscleGroup, VolumeStatus, MUSCLE_GROUPS } from '../types'
import { classifyVolumeStatus } from './mrv-mev-calculator'

export type FatigueLevel = 1 | 2 | 3 | 4 | 5

export interface PredictedFatigue {
  predictedSoreness: FatigueLevel
  volumePct: number       // sets / mrv as percentage (0-100+)
  volumeStatus: VolumeStatus
}

const STATUS_TO_SORENESS: Record<VolumeStatus, FatigueLevel> = {
  below_mev: 1,
  in_range: 2,
  approaching_mrv: 3,
  at_mrv: 4,
  exceeded_mrv: 5,
}
```

Function: `computePredictedFatigue(weeklyVolume: Record<MuscleGroup, number>, mrvMevConfig: MrvMevConfig): Record<MuscleGroup, PredictedFatigue>`

For each muscle: classify volume status using existing `classifyVolumeStatus`, map to predicted soreness via `STATUS_TO_SORENESS`, compute `volumePct = (sets / mrv) * 100`.

### detectMismatches

```typescript
export type MismatchDirection = 'accumulating_fatigue' | 'recovering_well'

export interface FatigueMismatch {
  muscle: MuscleGroup
  felt: FatigueLevel
  predicted: FatigueLevel
  difference: number          // felt - predicted (positive = felt worse)
  direction: MismatchDirection
}
```

Function: `detectMismatches(felt: Record<MuscleGroup, FatigueLevel>, predicted: Record<MuscleGroup, PredictedFatigue>): FatigueMismatch[]`

A mismatch is flagged when `|felt - predicted.predictedSoreness| >= 2`. Direction:
- `felt > predicted`: `accumulating_fatigue`
- `felt < predicted`: `recovering_well`

Returns array of mismatches sorted by absolute difference descending.

### Export

**File: `packages/training-engine/src/index.ts`**

Add `export * from './volume/fatigue-predictor'`.

### Tests

**File: `packages/training-engine/src/volume/__tests__/fatigue-predictor.test.ts`**

Test cases:
- `computePredictedFatigue`: below_mev → 1, in_range → 2, approaching_mrv → 3, at_mrv → 4, exceeded_mrv → 5
- `computePredictedFatigue`: volumePct calculation correct (e.g., 10 sets / 20 mrv = 50%)
- `detectMismatches`: no mismatches when all within 1 level
- `detectMismatches`: flags mismatch when difference is 2
- `detectMismatches`: correct direction classification
- `detectMismatches`: sorted by absolute difference descending
- `detectMismatches`: handles felt=5, predicted=1 (large mismatch)
