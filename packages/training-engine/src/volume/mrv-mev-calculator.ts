import {
  CompletedSetLog,
  MrvMevConfig,
  MuscleGroup,
  MuscleMapper,
  VolumeStatus,
} from '../types'

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

const ALL_MUSCLE_GROUPS: MuscleGroup[] = [
  'quads', 'hamstrings', 'glutes', 'lower_back', 'upper_back',
  'chest', 'triceps', 'shoulders', 'biceps',
]

function emptyVolumeMap(): Record<MuscleGroup, number> {
  return Object.fromEntries(ALL_MUSCLE_GROUPS.map((m) => [m, 0])) as Record<MuscleGroup, number>
}

export function computeWeeklyVolume(
  sessionLogs: CompletedSetLog[],
  muscleMapper: MuscleMapper,
): Record<MuscleGroup, number> {
  const raw = emptyVolumeMap()

  for (const log of sessionLogs) {
    const muscles = muscleMapper(log.lift, log.exercise)
    for (const { muscle, contribution } of muscles) {
      raw[muscle] += log.completedSets * contribution
    }
  }

  // Floor fractional contributions (secondary muscles accumulate in 0.5 increments)
  return Object.fromEntries(
    ALL_MUSCLE_GROUPS.map((m) => [m, Math.floor(raw[m])]),
  ) as Record<MuscleGroup, number>
}

export function classifyVolumeStatus(
  weeklyVolume: Record<MuscleGroup, number>,
  config: MrvMevConfig,
): Record<MuscleGroup, VolumeStatus> {
  return Object.fromEntries(
    ALL_MUSCLE_GROUPS.map((muscle) => {
      const sets = weeklyVolume[muscle]
      const { mev, mrv } = config[muscle]

      let status: VolumeStatus
      if (sets > mrv) {
        status = 'exceeded_mrv'
      } else if (sets === mrv) {
        status = 'at_mrv'
      } else if (mrv - sets <= 2) {
        status = 'approaching_mrv'
      } else if (sets >= mev) {
        status = 'in_range'
      } else {
        status = 'below_mev'
      }

      return [muscle, status]
    }),
  ) as Record<MuscleGroup, VolumeStatus>
}

export function computeRemainingCapacity(
  weeklyVolume: Record<MuscleGroup, number>,
  config: MrvMevConfig,
): Record<MuscleGroup, number> {
  return Object.fromEntries(
    ALL_MUSCLE_GROUPS.map((muscle) => [muscle, config[muscle].mrv - weeklyVolume[muscle]]),
  ) as Record<MuscleGroup, number>
}
