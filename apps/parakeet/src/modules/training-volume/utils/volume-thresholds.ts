import type { MuscleGroup, VolumeStatus } from '@parakeet/training-engine'

export type VolumeLevel = 'exceeded' | 'approaching' | 'in_range' | 'below'

export function classifyVolumeLevel(sets: number, mev: number, mrv: number): VolumeLevel {
  if (sets > mrv)          return 'exceeded'
  if (sets >= mrv * 0.8)   return 'approaching'
  if (sets >= mev)         return 'in_range'
  return 'below'
}

export function getMrvWarningMuscles(
  status: Record<MuscleGroup, VolumeStatus>,
): MuscleGroup[] {
  return (Object.entries(status) as [MuscleGroup, VolumeStatus][])
    .filter(([, s]) => s === 'at_mrv' || s === 'exceeded_mrv')
    .map(([m]) => m)
}
