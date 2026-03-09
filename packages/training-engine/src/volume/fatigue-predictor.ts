import { MUSCLE_GROUPS, MrvMevConfig, MuscleGroup, VolumeStatus } from '../types'
import { classifyVolumeStatus } from './mrv-mev-calculator'

export type FatigueLevel = 1 | 2 | 3 | 4 | 5

export type MismatchDirection = 'accumulating_fatigue' | 'recovering_well'

export interface PredictedFatigue {
  predicted: FatigueLevel
  /** Weekly sets / MRV as a fraction (e.g. 0.75 = 75% of MRV) */
  volumePct: number
  status: VolumeStatus
}

export interface FatigueMismatch {
  muscle: MuscleGroup
  felt: FatigueLevel
  predicted: FatigueLevel
  direction: MismatchDirection
  delta: number
}

const STATUS_TO_FATIGUE: Record<VolumeStatus, FatigueLevel> = {
  below_mev:      1,
  in_range:       2,
  approaching_mrv: 3,
  at_mrv:         4,
  exceeded_mrv:   5,
}

/** Predict end-of-week soreness per muscle group based on volume vs MRV/MEV config. */
export function computePredictedFatigue(
  weeklyVolume: Partial<Record<MuscleGroup, number>>,
  config: MrvMevConfig,
): Record<MuscleGroup, PredictedFatigue> {
  const fullVolume = Object.fromEntries(
    MUSCLE_GROUPS.map((m) => [m, weeklyVolume[m] ?? 0]),
  ) as Record<MuscleGroup, number>

  const statuses = classifyVolumeStatus(fullVolume, config)

  return Object.fromEntries(
    MUSCLE_GROUPS.map((muscle) => {
      const { mrv } = config[muscle]
      const sets = fullVolume[muscle]
      const volumePct = mrv > 0 ? sets / mrv : 0
      const status = statuses[muscle]
      const predicted = STATUS_TO_FATIGUE[status]
      return [muscle, { predicted, volumePct, status }]
    }),
  ) as Record<MuscleGroup, PredictedFatigue>
}

/** Detect muscles where |felt - predicted| >= 2. Sorted by delta descending. */
export function detectMismatches(
  felt: Partial<Record<MuscleGroup, FatigueLevel>>,
  predicted: Record<MuscleGroup, PredictedFatigue>,
): FatigueMismatch[] {
  const mismatches: FatigueMismatch[] = []

  for (const muscle of MUSCLE_GROUPS) {
    const feltLevel = felt[muscle] ?? 1
    const predictedLevel = predicted[muscle].predicted
    const delta = Math.abs(feltLevel - predictedLevel)

    if (delta >= 2) {
      mismatches.push({
        muscle,
        felt: feltLevel,
        predicted: predictedLevel,
        direction: feltLevel > predictedLevel ? 'accumulating_fatigue' : 'recovering_well',
        delta,
      })
    }
  }

  return mismatches.sort((a, b) => b.delta - a.delta)
}
