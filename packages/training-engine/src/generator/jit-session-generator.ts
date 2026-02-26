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
): AuxiliaryWork[] {
  return exercises.map((exercise) => {
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

    // Base: 3 sets × (10 male / 12 female) reps at 67.5% of 1RM, RPE 7.5
    const baseReps = biologicalSex === 'female' ? 12 : 10
    let setCount = 3
    let intensityMult = 1.0

    if (worstSoreness === 4) {
      setCount = Math.max(1, setCount - 1)
      intensityMult = 0.95
    } else if (worstSoreness === 3) {
      setCount = Math.max(1, setCount - 1)
    }

    const baseAuxWeight = roundToNearest(oneRmKg * 0.675)
    const finalWeight = roundToNearest(baseAuxWeight * intensityMult)

    const sets: PlannedSet[] = Array.from({ length: setCount }, (_, i) => ({
      set_number: i + 1,
      weight_kg: finalWeight,
      reps: baseReps,
      rpe_target: 7.5,
    }))

    return { exercise, sets, skipped: false }
  }) as AuxiliaryWork[]
}

// Re-export SorenessModifier so callers don't need a separate import
export type { SorenessModifier }
