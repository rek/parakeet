import type { Lift } from '@parakeet/shared-types'
import { MUSCLE_GROUPS } from '@parakeet/training-engine'
import type { MuscleGroup } from '@parakeet/training-engine'

export const MUSCLE_GROUPS_ORDER: readonly MuscleGroup[] = MUSCLE_GROUPS

export const MUSCLE_LABELS_FULL: Record<MuscleGroup, string> = {
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  lower_back: 'Lower Back',
  upper_back: 'Upper Back',
  chest: 'Chest',
  triceps: 'Triceps',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
}

export const MUSCLE_LABELS_COMPACT: Record<MuscleGroup, string> = {
  ...MUSCLE_LABELS_FULL,
  hamstrings: 'Hams',
}

export const MUSCLE_LABELS_ABBR: Record<MuscleGroup, string> = {
  quads: 'Q',
  hamstrings: 'H',
  glutes: 'G',
  lower_back: 'LB',
  upper_back: 'UB',
  chest: 'Ch',
  triceps: 'Tr',
  shoulders: 'Sh',
  biceps: 'Bi',
}

export const COMPACT_VOLUME_MUSCLES: readonly MuscleGroup[] = [
  'quads',
  'chest',
  'hamstrings',
  'upper_back',
  'lower_back',
]

export const TRAINING_LIFTS: readonly Lift[] = ['squat', 'bench', 'deadlift']

export const LIFT_LABELS: Record<Lift, string> = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
}

export const LIFT_PRIMARY_SORENESS_MUSCLES: Record<Lift, readonly MuscleGroup[]> = {
  squat: ['quads', 'glutes', 'lower_back'],
  bench: ['chest', 'triceps', 'shoulders'],
  deadlift: ['hamstrings', 'glutes', 'lower_back'],
}

export const SORENESS_MUSCLES_DEFAULT: ReadonlyArray<{
  value: MuscleGroup
  label: string
}> = [
  { value: 'quads', label: MUSCLE_LABELS_FULL.quads },
  { value: 'hamstrings', label: MUSCLE_LABELS_FULL.hamstrings },
  { value: 'glutes', label: MUSCLE_LABELS_FULL.glutes },
  { value: 'lower_back', label: MUSCLE_LABELS_FULL.lower_back },
  { value: 'upper_back', label: MUSCLE_LABELS_FULL.upper_back },
  { value: 'chest', label: MUSCLE_LABELS_FULL.chest },
]
