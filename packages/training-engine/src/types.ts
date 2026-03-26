import { IntensityType, Lift } from '@parakeet/shared-types';
import type { MuscleGroup } from '@parakeet/shared-types';

export interface BlockIntensityConfig {
  pct: number;
  sets: number;
  reps: number;
  reps_max?: number; // when present, reps is reps_min; sets include reps_range
  rpe_target: number;
}

export interface RepIntensityConfig {
  pct: number;
  sets_min: number;
  sets_max: number;
  reps_min: number;
  reps_max: number;
  rpe_target: number;
}

export interface BlockConfig {
  heavy: BlockIntensityConfig;
  explosive: BlockIntensityConfig;
  rep: RepIntensityConfig;
}

export interface DeloadConfig {
  pct: number;
  sets: number;
  reps: number;
  rpe_target: number;
}

export interface FormulaRestSeconds {
  block1: { heavy: number; explosive: number; rep: number };
  block2: { heavy: number; explosive: number; rep: number };
  block3: { heavy: number; explosive: number; rep: number };
  deload: number;
  auxiliary: number;
}

export interface FormulaConfig {
  block1: BlockConfig;
  block2: BlockConfig;
  block3: BlockConfig;
  deload: DeloadConfig;
  progressive_overload: {
    heavy_pct_increment_per_block: number;
  };
  training_max_increase: {
    bench_min: number;
    bench_max: number;
    squat_min: number;
    squat_max: number;
    deadlift_min: number;
    deadlift_max: number;
  };
  rounding_increment_kg: number;
  rest_seconds: FormulaRestSeconds;
}

// Recursive partial — used for user/AI overrides stored in DB
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type FormulaConfigOverrides = DeepPartial<FormulaConfig>;

// ---------------------------------------------------------------------------
// Muscle volume types (engine-006) — canonical source: @parakeet/shared-types
// ---------------------------------------------------------------------------

export {
  MUSCLE_CATALOG,
  MUSCLE_CATALOG_BY_ID,
  MUSCLE_GROUPS,
  PUSH_MUSCLES,
  PULL_MUSCLES,
} from '@parakeet/shared-types';
export type {
  MuscleCategory,
  MuscleGroup,
  MuscleGroupEntry,
} from '@parakeet/shared-types';

export type VolumeStatus =
  | 'below_mev'
  | 'in_range'
  | 'approaching_mrv'
  | 'at_mrv'
  | 'exceeded_mrv';

export type MrvMevConfig = Record<MuscleGroup, { mev: number; mrv: number }>;

export interface MuscleContribution {
  muscle: MuscleGroup;
  contribution: number; // 1.0 primary, 0.5 secondary
}

export type MuscleMapper = (
  lift: Lift | null,
  exercise?: string
) => MuscleContribution[];

export interface CompletedSetLog {
  lift: Lift | null;
  completedSets: number;
  exercise?: string;
  setRpes?: (number | undefined)[]; // one entry per set; undefined = not recorded
}

// ---------------------------------------------------------------------------
// Program scaffolding types (engine-004)
// ---------------------------------------------------------------------------

export interface SessionScaffold {
  weekNumber: number;
  dayNumber: number;
  primaryLift: Lift;
  intensityType: IntensityType;
  blockNumber: number | null; // null for deload week
  isDeload: boolean;
  plannedDate: Date;
  plannedSets: null; // always null; populated by JIT generator
  jitGeneratedAt: null;
}

export interface GenerateProgramInput {
  totalWeeks: number;
  trainingDaysPerWeek: number;
  startDate: Date;
  trainingDays?: number[]; // weekday indices 0=Sun..6=Sat; defaults to DEFAULT_TRAINING_DAYS[trainingDaysPerWeek]
}

export interface GeneratedProgramStructure {
  sessions: SessionScaffold[];
}

export type AuxiliaryPool = Partial<Record<Lift, string[]>>;

export interface AuxiliaryAssignment {
  blockNumber: number;
  lift: Lift;
  exercise1: string;
  exercise2: string;
}

// ---------------------------------------------------------------------------
// Performance adjuster types (engine-005)
// ---------------------------------------------------------------------------

export interface SessionLogSummary {
  session_id: string;
  lift: Lift;
  intensity_type: IntensityType;
  actual_rpe: number | null;
  target_rpe: number;
  completion_pct: number | null;
}

export interface AdjustmentThresholds {
  rpe_deviation_threshold: number;
  consecutive_sessions_required: number;
  incomplete_session_threshold: number;
  max_suggestions_per_lift: number;
}

export type PerformanceSuggestionType =
  | 'reduce_pct'
  | 'increase_pct'
  | 'flag_for_review';

export interface PerformanceSuggestion {
  type: PerformanceSuggestionType;
  affected_lift: Lift;
  affected_block: IntensityType | null;
  pct_adjustment: number | null;
  rationale: string;
  session_id?: string;
  completion_pct?: number;
}
