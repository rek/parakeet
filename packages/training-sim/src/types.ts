import {
  IntensityType,
  Lift,
  PlannedSet,
} from '@parakeet/shared-types'
import {
  AuxiliaryWork,
  JITOutput,
  MuscleGroup,
  MrvMevConfig,
  VolumeStatus,
  WarmupSet,
} from '@parakeet/training-engine'

// ---------------------------------------------------------------------------
// Persona — a frozen athlete profile
// ---------------------------------------------------------------------------

export interface Persona {
  name: string
  biologicalSex: 'male' | 'female'
  ageYears: number
  bodyweightKg: number
  squatMaxKg: number
  benchMaxKg: number
  deadliftMaxKg: number
  trainingAge: 'beginner' | 'intermediate' | 'advanced'
  /** Override MRV/MEV (defaults to sex-based defaults) */
  mrvMevOverrides?: Partial<MrvMevConfig>
  /** Bar weight in kg (default 20) */
  barWeightKg?: number
}

// ---------------------------------------------------------------------------
// Life Script — day-by-day simulation events
// ---------------------------------------------------------------------------

export type SorenessLevel = 1 | 2 | 3 | 4 | 5
export type ReadinessLevel = 1 | 2 | 3
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | 'late_luteal'
export type DisruptionType = 'injury' | 'illness' | 'travel' | 'fatigue' | 'equipment_unavailable' | 'other'
export type Severity = 'minor' | 'moderate' | 'major'

export interface SorenessInput {
  ratings: Partial<Record<MuscleGroup, SorenessLevel>>
}

export interface DisruptionEvent {
  type: DisruptionType
  severity: Severity
  affectedLifts?: Lift[]
  durationDays: number
  description?: string
}

export type DayEvent =
  | { type: 'train'; soreness?: SorenessInput; sleep?: ReadinessLevel; energy?: ReadinessLevel }
  | { type: 'skip'; reason?: string }
  | { type: 'disrupt'; disruption: DisruptionEvent }
  | { type: 'period-start' }
  | { type: 'rest' }

export interface LifeScript {
  name: string
  description?: string
  events: DayEvent[]
}

// ---------------------------------------------------------------------------
// Performance Model — how the athlete responds to training
// ---------------------------------------------------------------------------

export interface PerformanceModelConfig {
  /** 1RM gain per cycle (fraction, e.g. 0.01 = 1%) */
  oneRmGainPerCycle: number
  /** Base RPE offset from target (-1 = easier than expected, +1 = harder) */
  rpeDeviation: number
  /** How much RPE creeps up per week of a block (fatigue effect) */
  rpeFatiguePerWeek: number
}

// ---------------------------------------------------------------------------
// Simulation Log — everything the simulator records
// ---------------------------------------------------------------------------

export interface SimulatedSession {
  day: number
  weekNumber: number
  dayNumber: number
  primaryLift: Lift
  intensityType: IntensityType
  blockNumber: 1 | 2 | 3 | null
  isDeload: boolean

  // JIT output
  jitOutput: JITOutput
  mainLiftSets: PlannedSet[]
  warmupSets: WarmupSet[]
  auxiliaryWork: AuxiliaryWork[]

  // Simulated athlete response
  simulatedRpe: number
  completedAllSets: boolean

  // Context at time of session
  sorenessRatings: Partial<Record<MuscleGroup, SorenessLevel>>
  sleepQuality?: ReadinessLevel
  energyLevel?: ReadinessLevel
  cyclePhase?: CyclePhase
  weeklyVolumeSnapshot: Partial<Record<MuscleGroup, number>>
  volumeStatusSnapshot: Partial<Record<MuscleGroup, VolumeStatus>>

  // Flags
  skipped: boolean
  skipReason?: string
}

export interface SimulationLog {
  persona: Persona
  script: LifeScript
  totalDays: number
  totalWeeks: number
  sessions: SimulatedSession[]
  skippedDays: number
  disruptions: Array<{
    day: number
    disruption: DisruptionEvent
    resolvedDay: number
  }>
  /** 1RM at end of each week: weekNumber → lift → kg */
  oneRmProgression: Array<{ weekNumber: number; maxes: Record<Lift, number> }>
}

// ---------------------------------------------------------------------------
// Invariant Violations
// ---------------------------------------------------------------------------

export type InvariantSeverity = 'warning' | 'error'

export type InvariantCategory =
  | 'volume_safety'
  | 'intensity_coherence'
  | 'disruption_response'
  | 'cycle_phase'
  | 'auxiliary_balance'
  | 'session_sanity'

export interface InvariantViolation {
  category: InvariantCategory
  rule: string
  severity: InvariantSeverity
  message: string
  /** Which week this violation occurred in */
  weekNumber?: number
  /** Which session (day) this occurred in */
  day?: number
  /** Expected vs actual values for debugging */
  expected?: string
  actual?: string
}

// ---------------------------------------------------------------------------
// Simulation Report
// ---------------------------------------------------------------------------

export interface SimulationReport {
  persona: Persona
  script: LifeScript
  log: SimulationLog
  violations: InvariantViolation[]
  summary: {
    totalSessions: number
    skippedSessions: number
    totalViolations: number
    errors: number
    warnings: number
    passed: boolean
  }
}
