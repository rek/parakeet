import {
  IntensityType,
  Lift,
  PlannedSet,
  TrainingDisruption,
} from '@parakeet/shared-types';

import { getCyclePhaseModifier } from '../adjustments/cycle-phase-adjuster';
import {
  getReadinessModifier,
  ReadinessLevel,
} from '../adjustments/readiness-adjuster';
import {
  getPrimaryMusclesForSession,
  getSorenessModifier,
  getWorstSoreness,
  SorenessLevel,
  SorenessModifier,
} from '../adjustments/soreness-adjuster';
import {
  computeAuxWeight,
  getBodyweightPool,
  getLiftForExercise,
  getRepTarget,
} from '../auxiliary/exercise-catalog';
import { ExerciseType, getExerciseType } from '../auxiliary/exercise-types';
import { CyclePhase } from '../formulas/cycle-phase';
import { roundToNearest } from '../formulas/weight-rounding';
import { FormulaConfig, MrvMevConfig, MuscleGroup, PUSH_MUSCLES } from '../types';
import {
  getMusclesForExercise,
  getMusclesForLift,
} from '../volume/muscle-mapper';
import { PrescriptionTraceBuilder } from './prescription-trace';
import type { PrescriptionTrace, AuxExerciseTrace } from './prescription-trace';
import { calculateSets } from './set-calculator';
import {
  generateWarmupSets,
  WarmupProtocol,
  WarmupSet,
} from './warmup-calculator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecentSessionSummary {
  actual_rpe: number | null;
  target_rpe: number;
}

export interface JITInput {
  sessionId: string;
  weekNumber: number;
  blockNumber: number;
  primaryLift: Lift;
  intensityType: IntensityType;
  oneRmKg: number;
  formulaConfig: FormulaConfig;
  sorenessRatings: Partial<Record<MuscleGroup, SorenessLevel>>;
  weeklyVolumeToDate: Partial<Record<MuscleGroup, number>>;
  mrvMevConfig: MrvMevConfig;
  activeAuxiliaries: [string, string];
  recentLogs: RecentSessionSummary[];
  activeDisruptions: TrainingDisruption[];
  warmupConfig: WarmupProtocol;
  // Recency signal: days since the last completed session for this lift.
  // null = no history (first session ever). > 7 days triggers conservative modifier.
  daysSinceLastSession?: number | null;
  // Athlete demographics — optional; used by AI JIT generator (engine-011) for contextual advice
  biologicalSex?: 'female' | 'male';
  userAge?: number;
  // User rest overrides (sourced from rest_configs table, data-006)
  userRestOverrides?: Array<{
    lift?: Lift;
    intensityType?: IntensityType;
    restSeconds: number;
  }>;
  // Bar weight in kg — minimum warmup and recovery floor (default 20)
  barWeightKg?: number;
  // Flat pool of all available exercises across all lifts, used for volume top-up (engine-027)
  auxiliaryPool?: string[];
  // 1RM for each lift — used by volume top-up to calculate correct weights for cross-lift exercises
  allOneRmKg?: Partial<Record<Lift, number>>;
  // Readiness signals (engine-028): 1=poor/low, 2=ok/normal, 3=great/high
  sleepQuality?: ReadinessLevel;
  energyLevel?: ReadinessLevel;
  // Menstrual cycle phase for cycle-aware JIT adjustments (engine-030)
  cyclePhase?: CyclePhase;
  // Week progress for pro-rated MEV threshold in volume top-up (engine-027 fix)
  sessionIndex?: number; // 1-based position within the training week
  totalSessionsThisWeek?: number; // total planned sessions for this week
  // Primary lifts scheduled for remaining sessions this week — top-up skips exercises
  // associated with these lifts to avoid back-to-back muscle group loading (GH#95)
  upcomingLifts?: Lift[];
}

export interface AuxiliaryWork {
  exercise: string;
  sets: PlannedSet[];
  skipped: boolean;
  skipReason?: string;
  exerciseType: ExerciseType;
  /** True when this exercise was auto-added to top up a muscle below MEV (engine-027) */
  isTopUp?: boolean;
  /** Human-readable reason for the top-up, e.g. "hamstrings below MEV" */
  topUpReason?: string;
}

export interface JITOutput {
  sessionId: string;
  generatedAt: Date;
  mainLiftSets: PlannedSet[];
  warmupSets: WarmupSet[];
  auxiliaryWork: AuxiliaryWork[];
  volumeModifier: number;
  intensityModifier: number;
  rationale: string[];
  warnings: string[];
  skippedMainLift: boolean;
  restRecommendations: {
    /** Rest after each main working set (seconds), one entry per set by index */
    mainLift: number[];
    /** Rest after each auxiliary exercise (seconds), one entry per exercise */
    auxiliary: number[];
  };
  /** Which strategy produced this output. Populated by registry. */
  jit_strategy?: 'formula' | 'llm' | 'hybrid' | 'formula_fallback';
  /** Present only when the LLM strategy returned a restAdjustments field.
   *  Read by the mobile rest timer to decide whether to show the "AI suggested X min" chip. */
  llmRestSuggestion?: {
    /** The clamped delta (seconds) that was applied on top of the formula base */
    deltaSeconds: number;
    /** What the formula would have produced with no LLM input */
    formulaBaseSeconds: number;
  };
  /** Present only when HybridJITGenerator ran both strategies.
   *  Contains divergence metrics and the formula output for comparison display. */
  comparisonData?: {
    divergence: {
      /** |llmWeight - formulaWeight| / formulaWeight */
      weightPct: number;
      /** llmSets - formulaSets (signed) */
      setDelta: number;
      /** First line of LLM rationale used as context summary */
      rpeContextSummary: string;
    };
    formulaOutput: JITOutput;
    /** True when divergence exceeds display threshold (>15% weight or setDelta !== 0) */
    shouldSurfaceToUser: boolean;
  };
  /** Present when JIT reduced volume. Used by intra-session volume recovery to offer sets back. */
  volumeReductions?: {
    totalSetsRemoved: number;
    baseSetsCount: number;
    sources: Array<{ source: 'soreness' | 'readiness' | 'cycle_phase' | 'disruption'; setsRemoved: number }>;
    /** True only for soreness-5 recovery mode — blocks volume recovery offer */
    recoveryBlocked: boolean;
  };
}

/** Produces a minimal JITOutput for free-form ad-hoc sessions (no primary lift). */
export function createAdHocJITOutput(): JITOutput {
  return {
    sessionId: '',
    generatedAt: new Date(),
    mainLiftSets: [],
    warmupSets: [],
    auxiliaryWork: [],
    volumeModifier: 1,
    intensityModifier: 1,
    rationale: ['Ad-hoc session — no JIT generation'],
    warnings: [],
    skippedMainLift: true,
    restRecommendations: { mainLift: [], auxiliary: [] },
  };
}

// ---------------------------------------------------------------------------
// Rest resolution helpers
// ---------------------------------------------------------------------------

type BlockKey = 'block1' | 'block2' | 'block3';

function blockKey(blockNumber: number): BlockKey {
  const cycled = ((blockNumber - 1) % 3) + 1;
  return `block${cycled}` as BlockKey;
}

/** Look up rest seconds for a main working set from formula config.
 *  Deload sessions use the flat `deload` value; other sessions index by block + intensity. */
function resolveMainLiftRest(
  formulaConfig: FormulaConfig,
  block: number,
  intensityType: IntensityType
): number {
  if (intensityType === 'deload') {
    return formulaConfig.rest_seconds.deload;
  }
  const blockRest = formulaConfig.rest_seconds[blockKey(block)];
  // intensityType is 'heavy' | 'explosive' | 'rep' here (deload handled above)
  return blockRest[intensityType as 'heavy' | 'explosive' | 'rep'];
}

/** Apply user override if one matches this lift + intensity, returning the override's
 *  restSeconds. Specificity: lift+intensity > intensity-only > lift-only > catch-all. */
function applyRestOverride(
  overrides: NonNullable<JITInput['userRestOverrides']>,
  lift: Lift,
  intensityType: IntensityType,
  formulaRest: number
): number {
  // Most specific: both lift and intensityType match
  const specific = overrides.find(
    (o) => o.lift === lift && o.intensityType === intensityType
  );
  if (specific) return specific.restSeconds;

  // intensity-only match (no lift filter)
  const intensityOnly = overrides.find(
    (o) => o.lift === undefined && o.intensityType === intensityType
  );
  if (intensityOnly) return intensityOnly.restSeconds;

  // lift-only match (no intensity filter)
  const liftOnly = overrides.find(
    (o) => o.lift === lift && o.intensityType === undefined
  );
  if (liftOnly) return liftOnly.restSeconds;

  // Catch-all (neither field set)
  const catchAll = overrides.find(
    (o) => o.lift === undefined && o.intensityType === undefined
  );
  if (catchAll) return catchAll.restSeconds;

  return formulaRest;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function generateJITSession(input: JITInput, traceBuilder?: PrescriptionTraceBuilder): JITOutput {
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
    barWeightKg = 20,
  } = input;

  const rationale: string[] = [];
  const warnings: string[] = [];

  // Trace context
  traceBuilder?.setSessionContext({ sessionId, primaryLift, intensityType, blockNumber, oneRmKg });

  // Step 1 — Base sets from formula
  const baseSets = calculateSets(
    primaryLift,
    intensityType,
    blockNumber,
    oneRmKg,
    formulaConfig
  );
  const baseWeight = baseSets[0]?.weight_kg ?? 0;

  // Record base weight derivation in trace
  if (traceBuilder && baseSets.length > 0) {
    const blockPct = baseWeight / oneRmKg;
    traceBuilder.setBaseWeight({ oneRmKg, blockPct, baseWeightKg: baseWeight });
  }

  let intensityMultiplier = 1.0;
  let plannedCount = baseSets.length;
  const baseSetsCount = baseSets.length;
  let inRecoveryMode = false;
  let skippedMainLift = false;

  // Step 2 — Performance adjustment (RPE history)
  const rpeHistory = recentLogs
    .filter(
      (l): l is RecentSessionSummary & { actual_rpe: number } =>
        l.actual_rpe !== null
    )
    .slice(0, 2);

  if (rpeHistory.length >= 2) {
    const avgDev =
      rpeHistory.reduce((s, l) => s + (l.actual_rpe - l.target_rpe), 0) /
      rpeHistory.length;
    if (avgDev >= 1.0) {
      intensityMultiplier *= 0.975;
      rationale.push('Recent RPE above target — reduced intensity 2.5%');
      traceBuilder?.recordModifier({ source: 'rpe_history', multiplier: 0.975, reason: 'Recent RPE above target — intensity x0.975' });
    } else if (avgDev <= -1.0) {
      intensityMultiplier *= 1.025;
      rationale.push('Recent RPE below target — increased intensity 2.5%');
      traceBuilder?.recordModifier({ source: 'rpe_history', multiplier: 1.025, reason: 'Recent RPE below target — intensity x1.025' });
    }
  }

  // Step 2b — Readiness adjustment (sleep quality + energy level)
  const preReadinessCount = plannedCount;
  const readinessModifier = getReadinessModifier(
    input.sleepQuality,
    input.energyLevel
  );
  if (
    readinessModifier.setReduction > 0 ||
    readinessModifier.intensityMultiplier !== 1.0
  ) {
    plannedCount = Math.max(1, plannedCount - readinessModifier.setReduction);
    intensityMultiplier *= readinessModifier.intensityMultiplier;
    if (readinessModifier.rationale)
      rationale.push(readinessModifier.rationale);
    if (readinessModifier.intensityMultiplier !== 1.0) {
      traceBuilder?.recordModifier({ source: 'readiness', multiplier: readinessModifier.intensityMultiplier, reason: readinessModifier.rationale ?? 'Readiness adjustment' });
    }
  }
  const readinessSetsRemoved = preReadinessCount - plannedCount;
  if (readinessSetsRemoved > 0) {
    traceBuilder?.recordVolumeChange({ source: 'readiness', setsBefore: preReadinessCount, setsAfter: plannedCount, reason: readinessModifier.rationale ?? 'Readiness set reduction' });
  }

  // Step 2c — Cycle phase adjustment
  const preCyclePhaseCount = plannedCount;
  const cyclePhaseModifier = getCyclePhaseModifier(input.cyclePhase);
  if (
    cyclePhaseModifier.volumeModifier !== 0 ||
    cyclePhaseModifier.intensityMultiplier !== 1.0
  ) {
    plannedCount = Math.max(
      1,
      plannedCount + cyclePhaseModifier.volumeModifier
    );
    intensityMultiplier *= cyclePhaseModifier.intensityMultiplier;
    if (cyclePhaseModifier.rationale)
      rationale.push(cyclePhaseModifier.rationale);
    if (cyclePhaseModifier.intensityMultiplier !== 1.0) {
      traceBuilder?.recordModifier({ source: 'cycle_phase', multiplier: cyclePhaseModifier.intensityMultiplier, reason: cyclePhaseModifier.rationale ?? 'Cycle phase adjustment' });
    }
  }
  const cyclePhaseSetsRemoved = preCyclePhaseCount - plannedCount;
  if (cyclePhaseSetsRemoved > 0) {
    traceBuilder?.recordVolumeChange({ source: 'cycle_phase', setsBefore: preCyclePhaseCount, setsAfter: plannedCount, reason: cyclePhaseModifier.rationale ?? 'Cycle phase set reduction' });
  }

  // Step 3 — Soreness adjustment
  const preSorenessCount = plannedCount;
  const primaryMuscles = getPrimaryMusclesForSession(primaryLift);
  const worstSoreness = getWorstSoreness(primaryMuscles, sorenessRatings);
  const sorenessModifier = getSorenessModifier(
    worstSoreness,
    input.biologicalSex
  );

  if (sorenessModifier.recoveryMode) {
    inRecoveryMode = true;
    rationale.push('Severe soreness — recovery session');
    traceBuilder?.setRecoveryMode(true);
  } else {
    plannedCount = Math.max(1, plannedCount - sorenessModifier.setReduction);
    intensityMultiplier *= sorenessModifier.intensityMultiplier;
    if (sorenessModifier.warning) rationale.push(sorenessModifier.warning);
    if (sorenessModifier.intensityMultiplier !== 1.0) {
      traceBuilder?.recordModifier({ source: 'soreness', multiplier: sorenessModifier.intensityMultiplier, reason: sorenessModifier.warning ?? 'Soreness intensity adjustment' });
    }
  }
  const sorenessSetsRemoved = inRecoveryMode ? 0 : (preSorenessCount - plannedCount);
  if (sorenessSetsRemoved > 0) {
    traceBuilder?.recordVolumeChange({ source: 'soreness', setsBefore: preSorenessCount, setsAfter: plannedCount, reason: sorenessModifier.warning ?? 'Soreness set reduction' });
  }

  // Step 4 — MRV check (skipped in recovery mode)
  if (!inRecoveryMode) {
    const liftMuscles = getMusclesForLift(primaryLift);
    for (const { muscle, contribution } of liftMuscles) {
      if (!primaryMuscles.includes(muscle)) continue;
      const weeklyVol = weeklyVolumeToDate[muscle] ?? 0;
      const { mrv } = mrvMevConfig[muscle];
      const remainingCapacity = mrv - weeklyVol;
      if (remainingCapacity <= 0) {
        skippedMainLift = true;
        const prevCount = plannedCount;
        plannedCount = 0;
        warnings.push(`MRV exceeded for ${muscle} — main lift skipped`);
        traceBuilder?.setSkipped(true);
        traceBuilder?.recordVolumeChange({ source: 'mrv_cap', setsBefore: prevCount, setsAfter: 0, reason: `MRV exceeded for ${muscle}` });
        break;
      }
      const remainingSets = Math.floor(remainingCapacity / contribution);
      if (plannedCount > remainingSets) {
        const prevCount = plannedCount;
        warnings.push(
          `Approaching MRV for ${muscle} — sets capped at ${remainingSets}`
        );
        plannedCount = remainingSets;
        traceBuilder?.recordVolumeChange({ source: 'mrv_cap', setsBefore: prevCount, setsAfter: remainingSets, reason: `MRV cap for ${muscle}` });
      }
    }
  }

  // Step 5 — Disruption adjustment (compounds with steps 2–4, takes more conservative)
  const preDisruptionCount = plannedCount;
  const relevantDisruptions = activeDisruptions.filter(
    (d) => d.affected_lifts === null || d.affected_lifts.includes(primaryLift)
  );
  if (relevantDisruptions.length > 0 && !inRecoveryMode) {
    const severityOrder = { minor: 1, moderate: 2, major: 3 } as const;
    const worst = relevantDisruptions.reduce((w, d) =>
      severityOrder[d.severity] > severityOrder[w.severity] ? d : w
    );
    const desc = worst.description ?? 'Training disruption adjustment';

    if (worst.severity === 'major') {
      skippedMainLift = true;
      plannedCount = 0;
      rationale.push(`${desc} — main lift skipped`);
      traceBuilder?.setSkipped(true);
      traceBuilder?.recordVolumeChange({ source: 'disruption', setsBefore: preDisruptionCount, setsAfter: 0, reason: `${desc} — major disruption` });
    } else if (worst.severity === 'moderate') {
      // Take the more conservative of soreness-adjusted vs disruption-adjusted
      const disruptionSets = Math.max(1, Math.ceil(baseSets.length / 2));
      plannedCount = Math.min(plannedCount, disruptionSets);
      intensityMultiplier = Math.min(intensityMultiplier, 0.9);
      rationale.push(`${desc} — volume and intensity reduced`);
      traceBuilder?.recordModifier({ source: 'disruption', multiplier: 0.9, reason: `${desc} — moderate disruption` });
    } else {
      rationale.push(desc);
    }
  }
  const disruptionSetsRemoved = preDisruptionCount - plannedCount;
  if (disruptionSetsRemoved > 0 && !skippedMainLift) {
    traceBuilder?.recordVolumeChange({ source: 'disruption', setsBefore: preDisruptionCount, setsAfter: plannedCount, reason: 'Moderate disruption set reduction' });
  }

  // Note no-equipment disruption in rationale (aux boost handled in buildAuxiliaryWork)
  const hasNoEquipmentDisruption = activeDisruptions.some(
    (d) => d.disruption_type === 'equipment_unavailable'
  );
  if (hasNoEquipmentDisruption) {
    rationale.push(
      'No equipment available — auxiliary volume increased with bodyweight compensation exercises'
    );
  }

  // Step 7 — Final main lift sets
  let mainLiftSets: PlannedSet[];

  if (inRecoveryMode) {
    const recoveryWeight = Math.max(
      barWeightKg,
      roundToNearest(baseWeight * 0.4)
    );
    mainLiftSets = Array.from({ length: 3 }, (_, i) => ({
      set_number: i + 1,
      weight_kg: recoveryWeight,
      reps: 5,
      rpe_target: 5.0,
    }));
    traceBuilder?.setFinalWeight(recoveryWeight);
    traceBuilder?.recordSets(mainLiftSets.map((s) => ({
      setNumber: s.set_number, weightKg: s.weight_kg, reps: s.reps, rpeTarget: s.rpe_target ?? 0, repSource: 'recovery mode (3x5 @ RPE 5)',
    })));
  } else if (skippedMainLift || plannedCount === 0) {
    mainLiftSets = [];
  } else {
    const finalWeight = roundToNearest(baseWeight * intensityMultiplier);
    mainLiftSets = baseSets.slice(0, plannedCount).map((s, i) => ({
      ...s,
      set_number: i + 1,
      weight_kg: finalWeight,
    }));
    traceBuilder?.setFinalWeight(finalWeight);
    traceBuilder?.recordSets(mainLiftSets.map((s) => ({
      setNumber: s.set_number, weightKg: s.weight_kg, reps: s.reps, rpeTarget: s.rpe_target ?? 0,
      repSource: `block${((blockNumber - 1) % 3) + 1}.${intensityType} config`,
    })));
  }

  const volumeModifier =
    baseSets.length > 0 ? mainLiftSets.length / baseSets.length : 1.0;
  const intensityModifier = inRecoveryMode ? 0.4 : intensityMultiplier;

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
    primaryLift
  );

  // Step 6b — Volume top-up (engine-027): append exercises for under-MEV muscles
  // Cap at MAX_AUX_EXERCISES to keep total session exercises ≤ 6 (5 aux + 1 main lift)
  const MAX_AUX_EXERCISES = 5;
  if (input.auxiliaryPool && input.auxiliaryPool.length > 0) {
    const topUps = buildVolumeTopUp(
      input.auxiliaryPool,
      primaryLift,
      oneRmKg,
      mainLiftSets.length,
      weeklyVolumeToDate,
      mrvMevConfig,
      activeAuxiliaries,
      input.biologicalSex,
      input.sessionIndex,
      input.totalSessionsThisWeek,
      input.allOneRmKg,
      input.upcomingLifts
    );
    for (const tu of topUps) {
      const activeCount = auxiliaryWork.filter((a) => !a.skipped).length;
      if (activeCount >= MAX_AUX_EXERCISES) break;
      auxiliaryWork.push(tu);
      rationale.push(`Added ${tu.exercise}: ${tu.topUpReason}`);
    }
  }

  // Trace auxiliary exercises (assigned + top-ups)
  if (traceBuilder) {
    for (const aux of auxiliaryWork) {
      traceBuilder.recordAuxiliary({
        exercise: aux.exercise,
        selectionReason: aux.isTopUp
          ? (aux.topUpReason ?? 'volume top-up')
          : aux.skipped
            ? (aux.skipReason ?? 'skipped')
            : 'assigned auxiliary',
        weightTrace: (!aux.skipped && aux.sets[0]?.weight_kg > 0)
          ? {
              oneRmKg,
              catalogPct: oneRmKg > 0 ? aux.sets[0].weight_kg / oneRmKg : 0,
              scalingMethod: aux.exercise.startsWith('Dumbbell') || aux.exercise.startsWith('Kettlebell') ? 'sqrt' : 'linear',
              rawWeightKg: aux.sets[0].weight_kg,
              sorenessMultiplier: 1,
              finalWeightKg: aux.sets[0].weight_kg,
            }
          : null,
        reps: aux.sets[0]?.reps ?? 0,
        repSource: aux.isTopUp ? 'volume top-up default' : 'exercise catalog',
        sets: aux.sets.length,
        skipped: aux.skipped,
        skipReason: aux.skipReason,
      });
    }
  }

  // Step 8 — Warmup
  let warmupSets: WarmupSet[] = [];
  if (mainLiftSets.length > 0 && !skippedMainLift) {
    const workingWeight = mainLiftSets[0].weight_kg;
    const effectiveProtocol =
      inRecoveryMode || workingWeight < 40
        ? { type: 'preset' as const, name: 'minimal' as const }
        : warmupConfig;
    warmupSets = generateWarmupSets(
      workingWeight,
      effectiveProtocol,
      barWeightKg
    );
    traceBuilder?.recordWarmup({
      workingWeightKg: workingWeight,
      protocolName: effectiveProtocol.type === 'preset' ? effectiveProtocol.name : 'custom',
      steps: warmupSets.map((s) => ({ pct: workingWeight > 0 ? s.weightKg / workingWeight : 0, weightKg: s.weightKg, reps: s.reps })),
    });
  }

  // Step 9 — Rest recommendations
  const formulaMainRest = resolveMainLiftRest(
    formulaConfig,
    blockNumber,
    intensityType
  );
  const mainLiftRest =
    userRestOverrides && userRestOverrides.length > 0
      ? applyRestOverride(
          userRestOverrides,
          primaryLift,
          intensityType,
          formulaMainRest
        )
      : formulaMainRest;

  const restRecommendations = {
    mainLift: mainLiftSets.map(() => mainLiftRest),
    auxiliary: auxiliaryWork.map(() => formulaConfig.rest_seconds.auxiliary),
  };

  traceBuilder?.recordRest({
    mainLift: {
      formulaBaseSeconds: formulaMainRest,
      userOverrideSeconds: mainLiftRest !== formulaMainRest ? mainLiftRest : null,
      llmDeltaSeconds: null,
      finalSeconds: mainLiftRest,
    },
    auxiliarySeconds: formulaConfig.rest_seconds.auxiliary,
  });

  // Build volume reduction metadata for intra-session recovery
  const reductionSources: Array<{ source: 'soreness' | 'readiness' | 'cycle_phase' | 'disruption'; setsRemoved: number }> = [];
  if (readinessSetsRemoved > 0) reductionSources.push({ source: 'readiness', setsRemoved: readinessSetsRemoved });
  if (cyclePhaseSetsRemoved > 0) reductionSources.push({ source: 'cycle_phase', setsRemoved: cyclePhaseSetsRemoved });
  if (sorenessSetsRemoved > 0) reductionSources.push({ source: 'soreness', setsRemoved: sorenessSetsRemoved });
  if (disruptionSetsRemoved > 0) reductionSources.push({ source: 'disruption', setsRemoved: disruptionSetsRemoved });
  const totalSetsRemoved = readinessSetsRemoved + cyclePhaseSetsRemoved + sorenessSetsRemoved + disruptionSetsRemoved;

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
    ...(totalSetsRemoved > 0 && {
      volumeReductions: {
        totalSetsRemoved,
        baseSetsCount,
        sources: reductionSources,
        recoveryBlocked: inRecoveryMode,
      },
    }),
  };
}

/** Runs generateJITSession with trace instrumentation. Returns both the standard output and the trace. */
export function generateJITSessionWithTrace(input: JITInput) {
  const traceBuilder = new PrescriptionTraceBuilder();
  const output = generateJITSession(input, traceBuilder);
  const trace = traceBuilder.build({ rationale: output.rationale, warnings: output.warnings });
  return { output, trace };
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
  activeDisruptions?: TrainingDisruption[],
  primaryLift?: Lift
): AuxiliaryWork[] {
  const hasNoEquipment =
    activeDisruptions?.some(
      (d) => d.disruption_type === 'equipment_unavailable'
    ) ?? false;

  const result = exercises.map((exercise) => {
    const exerciseType = getExerciseType(exercise);

    // Soreness 5: skip entirely
    if (worstSoreness >= 5) {
      return {
        exercise,
        exerciseType,
        sets: [],
        skipped: true,
        skipReason: 'Severe soreness — auxiliary exercise skipped',
      };
    }

    // Timed exercises are not load-bearing — skip MRV check
    if (exerciseType !== 'timed') {
      // MRV check: insufficient remaining capacity after main lift
      for (const muscle of primaryMuscles) {
        const weeklyVol = weeklyVolumeToDate[muscle] ?? 0;
        const { mrv } = mrvMevConfig[muscle];
        const remaining = mrv - weeklyVol - mainLiftSetCount;
        if (remaining < 1) {
          warnings.push(`Approaching MRV for ${muscle} — ${exercise} skipped`);
          return {
            exercise,
            exerciseType,
            sets: [],
            skipped: true,
            skipReason: `MRV approaching for ${muscle}`,
          };
        }
      }
    }

    // Timed exercises: single "set" with weight 0, reps 0 — UI renders as mark-complete
    if (exerciseType === 'timed') {
      return {
        exercise,
        exerciseType,
        sets: [{ set_number: 1, weight_kg: 0, reps: 0, rpe_target: 7.0 }],
        skipped: false,
      };
    }

    // Base: per-exercise rep target (falls back to 10 male / 12 female)
    const baseReps = biologicalSex === 'female' ? 12 : 10;
    const reps = getRepTarget(exercise, baseReps);
    let setCount = 3;
    let intensityMult = 1.0;

    if (worstSoreness === 4) {
      setCount = Math.max(1, setCount - 1);
      intensityMult = 0.95;
    } else if (worstSoreness === 3) {
      setCount = Math.max(1, setCount - 1);
    }

    // No-equipment disruption: add an extra set to compensate for reduced barbell work
    if (hasNoEquipment) {
      setCount += 1;
    }

    // Bodyweight: no load — weight 0, reps only
    const finalWeight =
      exerciseType === 'bodyweight'
        ? 0
        : roundToNearest(
            roundToNearest(
              computeAuxWeight({ exercise, oneRmKg, lift: primaryLift ?? 'squat', biologicalSex })
            ) * intensityMult
          );

    const sets: PlannedSet[] = Array.from({ length: setCount }, (_, i) => ({
      set_number: i + 1,
      weight_kg: finalWeight,
      reps,
      rpe_target: 7.5,
    }));

    return { exercise, exerciseType, sets, skipped: false };
  }) as AuxiliaryWork[];

  // No-equipment disruption: append bodyweight compensation exercises
  // The global MAX_AUX_EXERCISES=5 cap in generateJITSession prevents the combined
  // total (bodyweight + volume top-ups) from exceeding 5 non-skipped aux exercises.
  if (hasNoEquipment && primaryLift && worstSoreness < 5) {
    const activeExerciseCount = result.filter((a) => !a.skipped).length;
    const maxTotalExercises = 5;
    const slotsAvailable = Math.max(0, maxTotalExercises - activeExerciseCount);

    if (slotsAvailable > 0) {
      const isFemale = biologicalSex === 'female';
      const sex = isFemale ? 'female' : 'male';
      const [bw1, bw2] = getBodyweightPool(primaryLift, sex);
      const bwReps = isFemale ? 15 : 10;
      const bwSets = (name: string): AuxiliaryWork => ({
        exercise: name,
        exerciseType: 'bodyweight' as ExerciseType,
        sets: Array.from({ length: 3 }, (_, i) => ({
          set_number: i + 1,
          weight_kg: 0,
          reps: bwReps,
          rpe_target: 7.0,
        })),
        skipped: false,
      });
      const bwExercises = [bw1, bw2].slice(0, slotsAvailable);
      for (const bw of bwExercises) {
        result.push(bwSets(bw));
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Volume top-up builder (engine-027)
// ---------------------------------------------------------------------------

/**
 * Auto-selects auxiliary exercises from the pool to top up muscles that will
 * still be below MEV after this session's main lift sets complete.
 *
 * Constraints (from spec engine-027):
 *   - Max 2 muscles per session
 *   - Only weighted/bodyweight exercises (exclude timed)
 *   - Max 3 sets per top-up
 *   - Exercises already in activeAuxiliaries are excluded
 *   - No top-up if no exercise in the pool targets the deficient muscle
 */
function buildVolumeTopUp(
  auxiliaryPool: string[],
  primaryLift: Lift,
  oneRmKg: number,
  mainLiftSetCount: number,
  weeklyVolumeToDate: Partial<Record<MuscleGroup, number>>,
  mrvMevConfig: MrvMevConfig,
  activeAuxiliaries: [string, string],
  biologicalSex?: 'female' | 'male',
  sessionIndex?: number,
  totalSessionsThisWeek?: number,
  allOneRmKg?: Partial<Record<Lift, number>>,
  upcomingLifts?: Lift[]
): AuxiliaryWork[] {
  // Build main lift muscle contributions to project post-session volume
  const liftMuscles = getMusclesForLift(primaryLift);
  const mainContrib = new Map<MuscleGroup, number>();
  for (const { muscle, contribution } of liftMuscles) {
    mainContrib.set(muscle, (mainContrib.get(muscle) ?? 0) + contribution);
  }

  // Find muscles below MEV after factoring in today's main lift
  const candidates: Array<{ muscle: MuscleGroup; deficit: number }> = [];
  for (const muscle of Object.keys(mrvMevConfig) as MuscleGroup[]) {
    const { mev } = mrvMevConfig[muscle];
    if (mev <= 0) continue;
    const weeklyVol = weeklyVolumeToDate[muscle] ?? 0;
    const primaryLiftContrib = mainContrib.get(muscle) ?? 0;
    const projected = weeklyVol + Math.floor(mainLiftSetCount * primaryLiftContrib);
    // Push muscles that receive zero direct contribution from today's primary lift
    // use the full MEV target rather than the pro-rated threshold. This front-loads
    // push coverage on squat/deadlift days, preventing zero-volume weeks when no
    // bench session occurs or bench is skipped.
    const effectiveMev =
      PUSH_MUSCLES.has(muscle) && primaryLiftContrib === 0
        ? mev
        : sessionIndex && totalSessionsThisWeek && totalSessionsThisWeek > 0
          ? Math.ceil((mev * sessionIndex) / totalSessionsThisWeek)
          : mev;
    const deficit = effectiveMev - projected;
    if (deficit > 0) candidates.push({ muscle, deficit });
  }

  // Highest deficit first, max 2 muscles
  candidates.sort((a, b) => b.deficit - a.deficit);
  const topCandidates = candidates.slice(0, 2);

  const result: AuxiliaryWork[] = [];
  const usedExercises = new Set<string>(activeAuxiliaries);

  for (const { muscle, deficit } of topCandidates) {
    // Find a qualifying exercise from the pool, excluding exercises associated
    // with lifts scheduled later this week to avoid back-to-back muscle loading
    const upcomingLiftSet = upcomingLifts?.length
      ? new Set(upcomingLifts)
      : undefined;
    const qualifying = auxiliaryPool.filter((exercise) => {
      if (usedExercises.has(exercise)) return false;
      if (getExerciseType(exercise) === 'timed') return false;
      if (upcomingLiftSet) {
        const exerciseLift = getLiftForExercise(exercise);
        if (exerciseLift && upcomingLiftSet.has(exerciseLift)) return false;
      }
      return getMusclesForExercise(exercise).some(
        (m) => m.muscle === muscle && m.contribution >= 1.0
      );
    });
    if (qualifying.length === 0) continue;

    const exercise = qualifying[0];
    usedExercises.add(exercise);

    const exerciseType = getExerciseType(exercise);
    const remainingMrv =
      mrvMevConfig[muscle].mrv - (weeklyVolumeToDate[muscle] ?? 0);
    const setCount = Math.max(1, Math.min(3, deficit, remainingMrv));

    const baseReps = biologicalSex === 'female' ? 12 : 10;
    const reps = getRepTarget(exercise, baseReps);
    const exerciseLift = getLiftForExercise(exercise);
    const effectiveOneRmKg =
      exerciseLift && allOneRmKg?.[exerciseLift] != null
        ? allOneRmKg[exerciseLift]!
        : oneRmKg;
    const finalWeight =
      exerciseType === 'bodyweight'
        ? 0
        : roundToNearest(
            computeAuxWeight({ exercise, oneRmKg: effectiveOneRmKg, lift: exerciseLift ?? primaryLift, biologicalSex })
          );

    const sets: PlannedSet[] = Array.from({ length: setCount }, (_, i) => ({
      set_number: i + 1,
      weight_kg: finalWeight,
      reps,
      rpe_target: 7.5,
    }));

    result.push({
      exercise,
      exerciseType,
      sets,
      skipped: false,
      isTopUp: true,
      topUpReason: `${muscle.replace('_', ' ')} below MEV`,
    });
  }

  return result;
}

// Re-export SorenessModifier so callers don't need a separate import
export type { SorenessModifier };
