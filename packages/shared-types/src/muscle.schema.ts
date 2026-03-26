export type MuscleCategory = 'push' | 'pull' | 'legs' | 'core';

export interface MuscleGroupEntry {
  readonly id: string;
  readonly label: string;
  readonly labelCompact: string;
  readonly abbr: string;
  readonly category: MuscleCategory;
}

export const MUSCLE_CATALOG = [
  { id: 'quads',      label: 'Quads',      labelCompact: 'Quads',       abbr: 'Q',  category: 'legs' },
  { id: 'hamstrings', label: 'Hamstrings',  labelCompact: 'Hams',       abbr: 'H',  category: 'legs' },
  { id: 'glutes',     label: 'Glutes',      labelCompact: 'Glutes',     abbr: 'G',  category: 'legs' },
  { id: 'lower_back', label: 'Lower Back',  labelCompact: 'Lower Back', abbr: 'LB', category: 'legs' },
  { id: 'upper_back', label: 'Upper Back',  labelCompact: 'Upper Back', abbr: 'UB', category: 'pull' },
  { id: 'chest',      label: 'Chest',       labelCompact: 'Chest',      abbr: 'Ch', category: 'push' },
  { id: 'triceps',    label: 'Triceps',     labelCompact: 'Triceps',    abbr: 'Tr', category: 'push' },
  { id: 'shoulders',  label: 'Shoulders',   labelCompact: 'Shoulders',  abbr: 'Sh', category: 'push' },
  { id: 'biceps',     label: 'Biceps',      labelCompact: 'Biceps',     abbr: 'Bi', category: 'pull' },
  { id: 'core',       label: 'Core',        labelCompact: 'Core',       abbr: 'Co', category: 'core' },
] as const satisfies readonly MuscleGroupEntry[];

export type MuscleGroup = (typeof MUSCLE_CATALOG)[number]['id'];
export const MUSCLE_GROUPS = MUSCLE_CATALOG.map(m => m.id);

export const MUSCLE_CATALOG_BY_ID = new Map(
  MUSCLE_CATALOG.map(m => [m.id, m] as const)
);
export const PUSH_MUSCLES = new Set<MuscleGroup>(
  MUSCLE_CATALOG.filter(m => m.category === 'push').map(m => m.id)
);
export const PULL_MUSCLES = new Set<MuscleGroup>(
  MUSCLE_CATALOG.filter(m => m.category === 'pull').map(m => m.id)
);
