import { IntensityType, Lift } from '@parakeet/shared-types'

export interface BlockIntensityConfig {
  pct: number
  sets: number
  reps: number
  reps_max?: number // when present, reps is reps_min; sets include reps_range
  rpe_target: number
}

export interface RepIntensityConfig {
  pct: number
  sets_min: number
  sets_max: number
  reps_min: number
  reps_max: number
  rpe_target: number
}

export interface BlockConfig {
  heavy: BlockIntensityConfig
  explosive: BlockIntensityConfig
  rep: RepIntensityConfig
}

export interface DeloadConfig {
  pct: number
  sets: number
  reps: number
  rpe_target: number
}

export interface FormulaConfig {
  block1: BlockConfig
  block2: BlockConfig
  block3: BlockConfig
  deload: DeloadConfig
  progressive_overload: {
    heavy_pct_increment_per_block: number
  }
  training_max_increase: {
    bench_min: number
    bench_max: number
    squat_min: number
    squat_max: number
    deadlift_min: number
    deadlift_max: number
  }
  rounding_increment_kg: number
}

// Recursive partial — used for user/AI overrides stored in DB
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

export type FormulaConfigOverrides = DeepPartial<FormulaConfig>

// ---------------------------------------------------------------------------
// Muscle volume types (engine-006)
// ---------------------------------------------------------------------------

export type MuscleGroup =
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'lower_back'
  | 'upper_back'
  | 'chest'
  | 'triceps'
  | 'shoulders'
  | 'biceps'

export type VolumeStatus =
  | 'below_mev'
  | 'in_range'
  | 'approaching_mrv'
  | 'at_mrv'
  | 'exceeded_mrv'

export type MrvMevConfig = Record<MuscleGroup, { mev: number; mrv: number }>

export interface MuscleContribution {
  muscle: MuscleGroup
  contribution: number // 1.0 primary, 0.5 secondary
}

export type MuscleMapper = (lift: Lift, exercise?: string) => MuscleContribution[]

export interface CompletedSetLog {
  lift: Lift
  completedSets: number
  exercise?: string
}

// ---------------------------------------------------------------------------
// Program scaffolding types (engine-004)
// ---------------------------------------------------------------------------

export interface SessionScaffold {
  weekNumber: number
  dayNumber: number
  primaryLift: Lift
  intensityType: IntensityType
  blockNumber: 1 | 2 | 3 | null // null for deload week
  isDeload: boolean
  plannedDate: Date
  plannedSets: null // always null; populated by JIT generator
  jitGeneratedAt: null
}

export interface GenerateProgramInput {
  totalWeeks: number
  trainingDaysPerWeek: number
  startDate: Date
}

export interface GeneratedProgramStructure {
  sessions: SessionScaffold[]
}

export type AuxiliaryPool = Partial<Record<Lift, string[]>>

export interface AuxiliaryAssignment {
  blockNumber: 1 | 2 | 3
  lift: Lift
  exercise1: string
  exercise2: string
}

// ---------------------------------------------------------------------------
// Performance adjuster types (engine-005)
// ---------------------------------------------------------------------------

export interface SessionLogSummary {
  session_id: string
  lift: Lift
  intensity_type: IntensityType
  actual_rpe: number | null
  target_rpe: number
  completion_pct: number | null
}

export interface AdjustmentThresholds {
  rpe_deviation_threshold: number
  consecutive_sessions_required: number
  incomplete_session_threshold: number
  max_suggestions_per_lift: number
}

export type PerformanceSuggestionType = 'reduce_pct' | 'increase_pct' | 'flag_for_review'

export interface PerformanceSuggestion {
  type: PerformanceSuggestionType
  affected_lift: Lift
  affected_block: IntensityType | null
  pct_adjustment: number | null
  rationale: string
  session_id?: string
  completion_pct?: number
}
