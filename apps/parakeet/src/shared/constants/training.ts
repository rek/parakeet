import type { Lift, MuscleGroup } from '@parakeet/shared-types';
import { MUSCLE_CATALOG, MUSCLE_GROUPS } from '@parakeet/shared-types';
import { LIFTS } from '@parakeet/training-engine';

export const MUSCLE_GROUPS_ORDER: readonly MuscleGroup[] = MUSCLE_GROUPS;

export const MUSCLE_LABELS_FULL = Object.fromEntries(
  MUSCLE_CATALOG.map((m) => [m.id, m.label])
) as Record<MuscleGroup, string>;

export const MUSCLE_LABELS_COMPACT = Object.fromEntries(
  MUSCLE_CATALOG.map((m) => [m.id, m.labelCompact])
) as Record<MuscleGroup, string>;

export const MUSCLE_LABELS_ABBR = Object.fromEntries(
  MUSCLE_CATALOG.map((m) => [m.id, m.abbr])
) as Record<MuscleGroup, string>;

export const COMPACT_VOLUME_MUSCLES: readonly MuscleGroup[] = [
  'quads',
  'chest',
  'hamstrings',
  'upper_back',
  'lower_back',
];

export const TRAINING_LIFTS = LIFTS;

export const SEX_LABELS: Record<string, string> = {
  female: 'Female',
  male: 'Male',
};

export const LIFT_LABELS: Record<Lift, string> = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
};

export const LIFT_PRIMARY_SORENESS_MUSCLES: Record<
  Lift,
  readonly MuscleGroup[]
> = {
  squat: ['quads', 'glutes', 'lower_back'],
  bench: ['chest', 'triceps', 'shoulders'],
  deadlift: ['hamstrings', 'glutes', 'lower_back'],
};

export const BLOCK_INTENSITY: Record<1 | 2 | 3, string> = {
  1: 'Heavy',
  2: 'Explosive',
  3: 'Rep',
};

export const INTENSITY_LABELS: Record<string, string> = {
  heavy: 'Heavy',
  explosive: 'Explosive',
  rep: 'Rep',
  deload: 'Deload',
};

/**
 * Fallback RPE target when JIT data is missing or incomplete.
 * Used across session completion, volume recovery, and weight autoregulation.
 */
export const DEFAULT_RPE_TARGET = 8.5;

/** Muscle contribution threshold for identifying primary muscles (vs secondary). */
export const PRIMARY_CONTRIBUTION_THRESHOLD = 1.0;

export const READINESS_LABELS = {
  sleep: { 1: 'Terrible', 2: 'Poor', 3: 'OK', 4: 'Good', 5: 'Great' } as const,
  energy: { 1: 'Drained', 2: 'Low', 3: 'OK', 4: 'Good', 5: 'High' } as const,
} as const;

export const SORENESS_MUSCLES_DEFAULT: ReadonlyArray<{
  value: MuscleGroup;
  label: string;
}> = [
  { value: 'quads', label: MUSCLE_LABELS_FULL.quads },
  { value: 'hamstrings', label: MUSCLE_LABELS_FULL.hamstrings },
  { value: 'glutes', label: MUSCLE_LABELS_FULL.glutes },
  { value: 'lower_back', label: MUSCLE_LABELS_FULL.lower_back },
  { value: 'upper_back', label: MUSCLE_LABELS_FULL.upper_back },
  { value: 'chest', label: MUSCLE_LABELS_FULL.chest },
];
