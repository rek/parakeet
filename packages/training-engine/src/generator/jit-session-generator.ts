import { IntensityType, Lift, PlannedSet, TrainingDisruption } from '@parakeet/shared-types'
import {
  getSorenessModifier,
  getPrimaryMusclesForSession,
  getWorstSoreness,
  SorenessLevel,
  SorenessModifier,
} from '../adjustments/soreness-adjuster'
import { roundToNearest } from '../formulas/weight-rounding'
import { FormulaConfig, MrvMevConfig, MuscleGroup } from '../types'
import { getMusclesForLift } from '../volume/muscle-mapper'
import { calculateSets } from './set-calculator'
import { generateWarmupSets, WarmupProtocol, WarmupSet } from './warmup-calculator'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecentSessionSummary {
  actual_rpe: number | null
  target_rpe: number
}

export interface JITInput {
  sessionId: string
  weekNumber: number
  blockNumber: 1 | 2 | 3
  primaryLift: Lift
  intensityType: IntensityType
  oneRmKg: number
  formulaConfig: FormulaConfig
  sorenessRatings: Partial<Record<MuscleGroup, SorenessLevel>>
  weeklyVolumeToDate: Partial<Record<MuscleGroup, number>>
  mrvMevConfig: MrvMevConfig
  activeAuxiliaries: [string, string]
  recentLogs: RecentSessionSummary[]
  activeDisruptions: TrainingDisruption[]
  warmupConfig: WarmupProtocol
  // Recency signal: days since the last completed session for this lift.
  // null = no history (first session ever). > 7 days triggers conservative modifier.
  daysSinceLastSession?: number | null
  // Athlete demographics — optional; used by AI JIT generator (engine-011) for contextual advice
  biologicalSex?: 'female' | 'male'
  userAge?: number
  // User rest overrides (sourced from rest_configs table, data-006)
  userRestOverrides?: Array<{
    lift?: Lift
    intensityType?: IntensityType
    restSeconds: number
  }>
}

export interface AuxiliaryWork {
  exercise: string
  sets: PlannedSet[]
  skipped: boolean
  skipReason?: string
}

export interface JITOutput {
  sessionId: string
  generatedAt: Date
  mainLiftSets: PlannedSet[]
  warmupSets: WarmupSet[]
  auxiliaryWork: AuxiliaryWork[]
  volumeModifier: number
  intensityModifier: number
  rationale: string[]
  warnings: string[]
  skippedMainLift: boolean
  restRecommendations: {
    /** Rest after each main working set (seconds), one entry per set by index */
    mainLift: number[]
    /** Rest after each auxiliary exercise (seconds), one entry per exercise */
    auxiliary: number[]
  }
  /** Which strategy produced this output. Populated by registry. */
  jit_strategy?: 'formula' | 'llm' | 'hybrid' | 'formula_fallback'
  /** Present only when the LLM strategy returned a restAdjustments field.
   *  Read by the mobile rest timer to decide whether to show the "AI suggested X min" chip. */
  llmRestSuggestion?: {
    /** The clamped delta (seconds) that was applied on top of the formula base */
    deltaSeconds: number
    /** What the formula would have produced with no LLM input */
    formulaBaseSeconds: number
  }
  /** Present only when HybridJITGenerator ran both strategies.
   *  Contains divergence metrics and the formula output for comparison display. */
  comparisonData?: {
    divergence: {
      /** |llmWeight - formulaWeight| / formulaWeight */
      weightPct: number
      /** llmSets - formulaSets (signed) */
      setDelta: number
      /** First line of LLM rationale used as context summary */
      rpeContextSummary: string
    }
    formulaOutput: JITOutput
    /** True when divergence exceeds display threshold (>15% weight or setDelta !== 0) */
    shouldSurfaceToUser: boolean
  }
}

// ---------------------------------------------------------------------------
// Rest resolution helpers
// ---------------------------------------------------------------------------

type BlockKey = 'block1' | 'block2' | 'block3'

function blockKey(blockNumber: 1 | 2 | 3): BlockKey {
  return `block${blockNumber}` as BlockKey
}

/** Look up rest seconds for a main working set from formula config.
 *  Deload sessions use the flat `deload` value; other sessions index by block + intensity. */
function resolveMainLiftRest(
  formulaConfig: FormulaConfig,
  block: 1 | 2 | 3,
  intensityType: IntensityType,
): number {
  if (intensityType === 'deload') {
    return formulaConfig.rest_seconds.deload
  }
  const blockRest = formulaConfig.rest_seconds[blockKey(block)]
  // intensityType is 'heavy' | 'explosive' | 'rep' here (deload handled above)
  return blockRest[intensityType as 'heavy' | 'explosive' | 'rep']
}

/** Apply user override if one matches this lift + intensity, returning the override's
 *  restSeconds. Specificity: lift+intensity > intensity-only > lift-only > catch-all. */
function applyRestOverride(
  overrides: NonNullable<JITInput['userRestOverrides']>,
  lift: Lift,
  intensityType: IntensityType,
  formulaRest: number,
): number {
  // Most specific: both lift and intensityType match
  const specific = overrides.find((o) => o.lift === lift && o.intensityType === intensityType)
  if (specific) return specific.restSeconds

  // intensity-only match (no lift filter)
  const intensityOnly = overrides.find((o) => o.lift === undefined && o.intensityType === intensityType)
  if (intensityOnly) return intensityOnly.restSeconds

  // lift-only match (no intensity filter)
  const liftOnly = overrides.find((o) => o.lift === lift && o.intensityType === undefined)
  if (liftOnly) return liftOnly.restSeconds

  // Catch-all (neither field set)
  const catchAll = overrides.find((o) => o.lift === undefined && o.intensityType === undefined)
  if (catchAll) return catchAll.restSeconds

  return formulaRest
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function generateJITSession(input: JITInput): JITOutput {
  const {
    sessionId,
    primaryLift,
    intensityType,
    blockNumber,
    oneRmKg,
    formulaConfig,
    sorenessRatings,
    weeklyVolumeToDate,
    mrvMevConfig,
    activeAuxiliaries,
    recentLogs,
    activeDisruptions,
    warmupConfig,
    userRestOverrides,
  } = input

  const rationale: string[] = []
  const warnings: string[] = []

  // Step 1 — Base sets from formula
  const baseSets = calculateSets(primaryLift, intensityType, blockNumber, oneRmKg, formulaConfig)
  const baseWeight = baseSets[0]?.weight_kg ?? 0

  let intensityMultiplier = 1.0
  let plannedCount = baseSets.length
  let inRecoveryMode = false
  let skippedMainLift = false

  // Step 2 — Performance adjustment (RPE history)
  const rpeHistory = recentLogs
    .filter((l): l is RecentSessionSummary & { actual_rpe: number } => l.actual_rpe !== null)
    .slice(0, 2)

  if (rpeHistory.length >= 2) {
    const avgDev =
      rpeHistory.reduce((s, l) => s + (l.actual_rpe - l.target_rpe), 0) / rpeHistory.length
    if (avgDev >= 1.0) {
      intensityMultiplier *= 0.975
      rationale.push('Recent RPE above target — reduced intensity 2.5%')
    } else if (avgDev <= -1.0) {
      intensityMultiplier *= 1.025
      rationale.push('Recent RPE below target — increased intensity 2.5%')
    }
  }

  // Step 3 — Soreness adjustment
  const primaryMuscles = getPrimaryMusclesForSession(primaryLift)
  const worstSoreness = getWorstSoreness(primaryMuscles, sorenessRatings)
  const sorenessModifier = getSorenessModifier(worstSoreness, input.biologicalSex)

  if (sorenessModifier.recoveryMode) {
    inRecoveryMode = true
    rationale.push('Severe soreness — recovery session')
  } else {
    plannedCount = Math.max(1, plannedCount - sorenessModifier.setReduction)
    intensityMultiplier *= sorenessModifier.intensityMultiplier
    if (sorenessModifier.warning) rationale.push(sorenessModifier.warning)
  }

  // Step 4 — MRV check (skipped in recovery mode)
  if (!inRecoveryMode) {
    const liftMuscles = getMusclesForLift(primaryLift)
    for (const { muscle, contribution } of liftMuscles) {
      if (!primaryMuscles.includes(muscle)) continue
      const weeklyVol = weeklyVolumeToDate[muscle] ?? 0
      const { mrv } = mrvMevConfig[muscle]
      const remainingCapacity = mrv - weeklyVol
      if (remainingCapacity <= 0) {
        skippedMainLift = true
        plannedCount = 0
        warnings.push(`MRV exceeded for ${muscle} — main lift skipped`)
        break
      }
      const remainingSets = Math.floor(remainingCapacity / contribution)
      if (plannedCount > remainingSets) {
        warnings.push(`Approaching MRV for ${muscle} — sets capped at ${remainingSets}`)
        plannedCount = remainingSets
      }
    }
  }

  // Step 5 — Disruption override (takes full precedence over steps 2–4)
  const relevantDisruptions = activeDisruptions.filter(
    (d) => d.affected_lifts === null || d.affected_lifts.includes(primaryLift),
  )
  if (relevantDisruptions.length > 0 && !inRecoveryMode) {
    intensityMultiplier = 1.0
    plannedCount = baseSets.length
    skippedMainLift = false

    const severityOrder = { minor: 1, moderate: 2, major: 3 } as const
    const worst = relevantDisruptions.reduce((w, d) =>
      severityOrder[d.severity] > severityOrder[w.severity] ? d : w,
    )
    const desc = worst.description ?? 'Training disruption adjustment'

    if (worst.severity === 'major') {
      skippedMainLift = true
      plannedCount = 0
      rationale.push(`${desc} — main lift skipped`)
    } else if (worst.severity === 'moderate') {
      plannedCount = Math.max(1, Math.ceil(baseSets.length / 2))
      intensityMultiplier = 0.90
      rationale.push(`${desc} — volume and intensity reduced`)
    } else {
      rationale.push(desc)
    }
  }

  // Note no-equipment disruption in rationale (aux boost handled in buildAuxiliaryWork)
  const hasNoEquipmentDisruption = activeDisruptions.some((d) => d.disruption_type === 'equipment_unavailable')
  if (hasNoEquipmentDisruption) {
    rationale.push('No equipment available — auxiliary volume increased with bodyweight compensation exercises')
  }

  // Step 7 — Final main lift sets
  let mainLiftSets: PlannedSet[]

  if (inRecoveryMode) {
    const recoveryWeight = Math.max(20, roundToNearest(baseWeight * 0.40))
    mainLiftSets = Array.from({ length: 3 }, (_, i) => ({
      set_number: i + 1,
      weight_kg: recoveryWeight,
      reps: 5,
      rpe_target: 5.0,
    }))
  } else if (skippedMainLift || plannedCount === 0) {
    mainLiftSets = []
  } else {
    const finalWeight = roundToNearest(baseWeight * intensityMultiplier)
    mainLiftSets = baseSets.slice(0, plannedCount).map((s, i) => ({
      ...s,
      set_number: i + 1,
      weight_kg: finalWeight,
    }))
  }

  const volumeModifier = baseSets.length > 0 ? mainLiftSets.length / baseSets.length : 1.0
  const intensityModifier = inRecoveryMode ? 0.40 : intensityMultiplier

  // Step 6 — Auxiliary work
  const auxiliaryWork = buildAuxiliaryWork(
    activeAuxiliaries,
    oneRmKg,
    mainLiftSets.length,
    weeklyVolumeToDate,
    mrvMevConfig,
    primaryMuscles,
    worstSoreness,
    warnings,
    input.biologicalSex,
    activeDisruptions,
    primaryLift,
  )

  // Step 8 — Warmup
  let warmupSets: WarmupSet[] = []
  if (mainLiftSets.length > 0 && !skippedMainLift) {
    const workingWeight = mainLiftSets[0].weight_kg
    const effectiveProtocol =
      inRecoveryMode || workingWeight < 40
        ? { type: 'preset' as const, name: 'minimal' as const }
        : warmupConfig
    warmupSets = generateWarmupSets(workingWeight, effectiveProtocol)
  }

  // Step 9 — Rest recommendations
  const formulaMainRest = resolveMainLiftRest(formulaConfig, blockNumber, intensityType)
  const mainLiftRest =
    userRestOverrides && userRestOverrides.length > 0
      ? applyRestOverride(userRestOverrides, primaryLift, intensityType, formulaMainRest)
      : formulaMainRest

  const restRecommendations = {
    mainLift: mainLiftSets.map(() => mainLiftRest),
    auxiliary: auxiliaryWork.map(() => formulaConfig.rest_seconds.auxiliary),
  }

  return {
    sessionId,
    generatedAt: new Date(),
    mainLiftSets,
    warmupSets,
    auxiliaryWork,
    volumeModifier,
    intensityModifier,
    rationale,
    warnings,
    skippedMainLift,
    restRecommendations,
  }
}

// ---------------------------------------------------------------------------
// Auxiliary work builder
// ---------------------------------------------------------------------------

// Per-exercise weight percentage of primary lift 1RM.
// Default (not in map) is 0.675 — appropriate for compound variations close to the main lift.
// Exercises that diverge significantly from the primary lift pattern need their own value:
//   - Unilateral exercises: much lower absolute load per side
//   - Spinal-loading technique lifts (Good Mornings): kept light for safety
//   - OHP/JM Press: bench 1RM doesn't transfer well to vertical pressing
//   - Isolation (curls): primary lift 1RM is irrelevant
const AUX_WEIGHT_PCT: Record<string, number> = {
  // Squat — unilateral / machine (lower absolute load)
  'Bulgarian Split Squat': 0.40,
  // Deadlift — spinal-loading technique lift (keep light)
  'Good Mornings': 0.35,
  // Bench — vertical press / tricep isolation (bench 1RM doesn't transfer)
  'Overhead Press': 0.58,
  'JM Press': 0.50,
  // Biceps isolation (bench/squat/deadlift 1RM is irrelevant)
  'Barbell Curl': 0.35,
  'Dumbbell Curl': 0.30,
  'Cable Curl': 0.30,
  'EZ-Bar Curl': 0.33,
}

// Per-exercise rep targets. Overrides the sex-based fallback (10M / 12F).
// Strength variations use lower reps; hypertrophy / isolation use higher reps.
const AUX_REP_TARGETS: Record<string, number> = {
  // Squat — strength
  'Pause Squat': 4, 'Box Squat': 4, 'Front Squat': 4, 'High-Bar Squat': 4,
  // Squat — hypertrophy
  'Bulgarian Split Squat': 10, 'Leg Press': 12, 'Hack Squat': 10,
  // Bench — strength
  'Close-Grip Bench': 5, 'Floor Press': 5, 'Board Press': 4,
  'Spoto Press': 5, '1 Inch Pause Bench': 4, 'JM Press': 6,
  // Bench — hypertrophy
  'Incline DB Press': 10, 'Dips': 10, 'Overhead Press': 8,
  // Bench — biceps
  'Barbell Curl': 10, 'Dumbbell Curl': 12, 'Cable Curl': 12, 'EZ-Bar Curl': 10,
  // Deadlift — strength
  'Block Pulls': 4, 'Deficit DL': 4, 'Sumo DL': 4, 'Rack Pulls': 4,
  // Deadlift — hypertrophy / high-rep
  'Romanian DL': 8, 'Stiff-Leg DL': 8, 'Good Mornings': 10, 'Hyperextensions': 15,
}

const BODYWEIGHT_POOLS: Record<Lift, { male: readonly string[]; female: readonly string[] }> = {
  squat: {
    male: ['Jump Squat', 'Pistol Squat', 'Bulgarian Split Squat', 'Box Jump'],
    female: ['Sumo Squat', 'Curtsy Lunge', 'Hip Thrust', 'Glute Bridge'],
  },
  bench: {
    male: ['Decline Push-ups', 'Diamond Push-ups', 'Archer Push-ups', 'Pike Push-ups'],
    female: ['Standard Push-ups', 'Wide Push-ups', 'Pike Push-ups', 'Close-Grip Push-ups'],
  },
  deadlift: {
    male: ['Nordic Hamstring Curl', 'Single-Leg RDL', 'Bodyweight Good Morning', 'Hyperextension'],
    female: ['Hip Thrust', 'Single-Leg Glute Bridge', 'Donkey Kick', 'Glute Kickback'],
  },
}

function buildAuxiliaryWork(
  exercises: [string, string],
  oneRmKg: number,
  mainLiftSetCount: number,
  weeklyVolumeToDate: Partial<Record<MuscleGroup, number>>,
  mrvMevConfig: MrvMevConfig,
  primaryMuscles: MuscleGroup[],
  worstSoreness: SorenessLevel,
  warnings: string[],
  biologicalSex?: 'female' | 'male',
  activeDisruptions?: TrainingDisruption[],
  primaryLift?: Lift,
): AuxiliaryWork[] {
  const hasNoEquipment = activeDisruptions?.some((d) => d.disruption_type === 'equipment_unavailable') ?? false

  const result = exercises.map((exercise) => {
    // Soreness 5: skip entirely
    if (worstSoreness >= 5) {
      return {
        exercise,
        sets: [],
        skipped: true,
        skipReason: 'Severe soreness — auxiliary exercise skipped',
      }
    }

    // MRV check: insufficient remaining capacity after main lift
    for (const muscle of primaryMuscles) {
      const weeklyVol = weeklyVolumeToDate[muscle] ?? 0
      const { mrv } = mrvMevConfig[muscle]
      const remaining = mrv - weeklyVol - mainLiftSetCount
      if (remaining < 1) {
        warnings.push(`Approaching MRV for ${muscle} — ${exercise} skipped`)
        return {
          exercise,
          sets: [],
          skipped: true,
          skipReason: `MRV approaching for ${muscle}`,
        }
      }
    }

    // Base: per-exercise rep target (falls back to 10 male / 12 female)
    const baseReps = biologicalSex === 'female' ? 12 : 10
    const reps = AUX_REP_TARGETS[exercise] ?? baseReps
    let setCount = 3
    let intensityMult = 1.0

    if (worstSoreness === 4) {
      setCount = Math.max(1, setCount - 1)
      intensityMult = 0.95
    } else if (worstSoreness === 3) {
      setCount = Math.max(1, setCount - 1)
    }

    // No-equipment disruption: add an extra set to compensate for reduced barbell work
    if (hasNoEquipment) {
      setCount += 1
    }

    const baseAuxWeight = roundToNearest(oneRmKg * (AUX_WEIGHT_PCT[exercise] ?? 0.675))
    const finalWeight = roundToNearest(baseAuxWeight * intensityMult)

    const sets: PlannedSet[] = Array.from({ length: setCount }, (_, i) => ({
      set_number: i + 1,
      weight_kg: finalWeight,
      reps,
      rpe_target: 7.5,
    }))

    return { exercise, sets, skipped: false }
  }) as AuxiliaryWork[]

  // No-equipment disruption: append bodyweight compensation exercises
  if (hasNoEquipment && primaryLift && worstSoreness < 5) {
    const pool = BODYWEIGHT_POOLS[primaryLift]
    const isFemale = biologicalSex === 'female'
    const [bw1, bw2] = isFemale ? pool.female : pool.male
    // Female pool uses moderate exercises (Hip Thrust, Push-ups) → 15 reps
    // Male pool uses harder exercises (Nordic Curl, Pistol Squat) → 10 reps
    const bwReps = isFemale ? 15 : 10
    const bwSets = (name: string): AuxiliaryWork => ({
      exercise: name,
      sets: Array.from({ length: 3 }, (_, i) => ({
        set_number: i + 1,
        weight_kg: 0,
        reps: bwReps,
        rpe_target: 7.0,
      })),
      skipped: false,
    })
    result.push(bwSets(bw1), bwSets(bw2))
  }

  return result
}

// Re-export SorenessModifier so callers don't need a separate import
export type { SorenessModifier }
