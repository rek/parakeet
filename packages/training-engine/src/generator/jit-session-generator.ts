import {
  IntensityType,
  Lift,
  PlannedSet,
  TrainingDisruption,
} from '@parakeet/shared-types';

import { ReadinessLevel } from '../adjustments/readiness-adjuster';
import {
  SorenessLevel,
  SorenessModifier,
} from '../adjustments/soreness-adjuster';
import {
  CATALOG_BY_NAME,
  computeAuxWeight,
  getBodyweightPool,
  getLiftForExercise,
  getRepTarget,
  MovementPattern,
  resolveMovementPattern,
} from '../auxiliary/exercise-catalog';
import { rankExercises } from '../auxiliary/exercise-scorer';
import { ExerciseType, getExerciseType } from '../auxiliary/exercise-types';
import { CyclePhase } from '../formulas/cycle-phase';
import { roundToNearest } from '../formulas/weight-rounding';
import {
  FormulaConfig,
  MrvMevConfig,
  MuscleGroup,
  PUSH_MUSCLES,
} from '../types';
import {
  getMusclesForExercise,
  getMusclesForLift,
} from '../volume/muscle-mapper';
import { PrescriptionTraceBuilder } from './prescription-trace';
import { applyCyclePhaseAdjustment } from './steps/applyCyclePhaseAdjustment';
import { applyDisruptionAdjustment } from './steps/applyDisruptionAdjustment';
import { applyMrvCap } from './steps/applyMrvCap';
import { applyReadinessAdjustment } from './steps/applyReadinessAdjustment';
import { applyRepRangeAdjustment } from './steps/applyRepRangeAdjustment';
import { applyRpeAdjustment } from './steps/applyRpeAdjustment';
import { applySorenessAdjustment } from './steps/applySorenessAdjustment';
import { applyVolumeCalibration } from './steps/applyVolumeCalibration';
import { buildFinalMainSets } from './steps/buildFinalMainSets';
import { initPipeline } from './steps/initPipeline';
import { processAuxExercise } from './steps/processAuxExercise';
import {
  generateWarmupSets,
  resolveEffectiveWarmupProtocol,
  WarmupProtocol,
  WarmupSet,
} from './warmup-calculator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecentSessionSummary {
  actual_rpe: number | null;
  target_rpe: number;
  // Weight context from past sessions (optional — backward compatible)
  plannedWeightKg?: number;
  actualMaxWeightKg?: number;
  deviationKg?: number;
  estimatedOneRmKg?: number;
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
  /** True when the user explicitly chose this warmup protocol (not a default). */
  warmupConfigExplicit?: boolean;
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
  // Per-athlete modifier calibration adjustments (engine-041). Signed deltas applied
  // on top of default modifier multipliers. Positive = less aggressive, negative = more aggressive.
  modifierCalibrations?: Partial<
    Record<
      'rpe_history' | 'readiness' | 'cycle_phase' | 'soreness' | 'disruption',
      number
    >
  >;
  // Working 1RM context (GH#98). When present, oneRmKg is the working value;
  // storedOneRmKg is the original from lifter_maxes.
  storedOneRmKg?: number;
  oneRmSource?: 'stored' | 'working';
  // Adaptive volume calibration (engine-043 Phase 2).
  // Recent post-session capacity assessments: 1=barely survived, 2=about right, 3=had more, 4=way too easy.
  capacityHistory?: number[];
  // Weekly body review mismatch direction for primary muscles: 'recovering_well' | 'accumulating_fatigue' | null.
  weeklyMismatchDirection?: 'recovering_well' | 'accumulating_fatigue' | null;
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
    sources: Array<{
      source: 'soreness' | 'readiness' | 'cycle_phase' | 'disruption';
      setsRemoved: number;
    }>;
    /** True only for severe soreness (9-10) recovery mode — blocks volume recovery offer */
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

export function generateJITSession(
  input: JITInput,
  traceBuilder?: PrescriptionTraceBuilder
): JITOutput {
  const {
    sessionId,
    primaryLift,
    intensityType,
    blockNumber,
    oneRmKg,
    formulaConfig,
    activeAuxiliaries,
    warmupConfig,
    userRestOverrides,
    barWeightKg = 20,
  } = input;

  // Step 1 — Initialize pipeline context (base sets, primary muscles, soreness)
  const ctx = initPipeline(input, traceBuilder);

  // Step 0 — Adaptive volume calibration (can increase or decrease base set count)
  applyVolumeCalibration(ctx, input, traceBuilder);

  // Steps 2–7 — Modifier pipeline (each step mutates ctx, can only reduce)
  applyRpeAdjustment(ctx, input, traceBuilder);
  applyRepRangeAdjustment(ctx, input);
  applyReadinessAdjustment(ctx, input, traceBuilder);
  applyCyclePhaseAdjustment(ctx, input, traceBuilder);
  applySorenessAdjustment(ctx, input, traceBuilder);
  applyMrvCap(ctx, input, traceBuilder);
  applyDisruptionAdjustment(ctx, input, traceBuilder);

  // Step 7 — Final main lift sets
  const mainLiftSets = buildFinalMainSets(ctx, input, traceBuilder);

  const volumeModifier =
    ctx.baseSets.length > 0 ? mainLiftSets.length / ctx.baseSets.length : 1.0;
  const intensityModifier = ctx.inRecoveryMode ? 0.4 : ctx.intensityMultiplier;

  // Step 6 — Auxiliary work
  const auxiliaryWork = buildAuxiliaryWork(
    activeAuxiliaries,
    oneRmKg,
    mainLiftSets.length,
    input.weeklyVolumeToDate,
    input.mrvMevConfig,
    ctx.primaryMuscles,
    ctx.worstSoreness,
    ctx.warnings,
    input.biologicalSex,
    input.activeDisruptions,
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
      input.weeklyVolumeToDate,
      input.mrvMevConfig,
      activeAuxiliaries,
      input.biologicalSex,
      input.sessionIndex,
      input.totalSessionsThisWeek,
      input.allOneRmKg,
      input.upcomingLifts,
      input.sorenessRatings,
      input.sleepQuality,
      input.energyLevel,
      input.activeDisruptions
    );
    for (const tu of topUps) {
      const activeCount = auxiliaryWork.filter((a) => !a.skipped).length;
      if (activeCount >= MAX_AUX_EXERCISES) break;
      auxiliaryWork.push(tu);
      ctx.rationale.push(`Added ${tu.exercise}: ${tu.topUpReason}`);
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
        weightTrace:
          !aux.skipped && aux.sets[0]?.weight_kg > 0
            ? {
                oneRmKg,
                catalogPct: oneRmKg > 0 ? aux.sets[0].weight_kg / oneRmKg : 0,
                scalingMethod:
                  aux.exercise.startsWith('Dumbbell') ||
                  aux.exercise.startsWith('Kettlebell')
                    ? 'sqrt'
                    : 'linear',
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
  if (mainLiftSets.length > 0 && !ctx.skippedMainLift) {
    const workingWeight = mainLiftSets[0].weight_kg;
    const effectiveProtocol = resolveEffectiveWarmupProtocol({
      workingWeightKg: workingWeight,
      warmupConfig,
      warmupConfigExplicit: input.warmupConfigExplicit,
      primaryLift: input.primaryLift,
      sorenessRatings: input.sorenessRatings,
      biologicalSex: input.biologicalSex,
    });
    warmupSets = generateWarmupSets(
      workingWeight,
      effectiveProtocol,
      barWeightKg
    );
    traceBuilder?.recordWarmup({
      workingWeightKg: workingWeight,
      protocolName:
        effectiveProtocol.type === 'preset' ? effectiveProtocol.name : 'custom',
      steps: warmupSets.map((s) => ({
        pct: workingWeight > 0 ? s.weightKg / workingWeight : 0,
        weightKg: s.weightKg,
        reps: s.reps,
      })),
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
      userOverrideSeconds:
        mainLiftRest !== formulaMainRest ? mainLiftRest : null,
      llmDeltaSeconds: null,
      finalSeconds: mainLiftRest,
    },
    auxiliarySeconds: formulaConfig.rest_seconds.auxiliary,
  });

  // Build volume reduction metadata for intra-session recovery
  const reductionSources: Array<{
    source: 'soreness' | 'readiness' | 'cycle_phase' | 'disruption';
    setsRemoved: number;
  }> = [];
  if (ctx.readinessSetsRemoved > 0)
    reductionSources.push({
      source: 'readiness',
      setsRemoved: ctx.readinessSetsRemoved,
    });
  if (ctx.cyclePhaseSetsRemoved > 0)
    reductionSources.push({
      source: 'cycle_phase',
      setsRemoved: ctx.cyclePhaseSetsRemoved,
    });
  if (ctx.sorenessSetsRemoved > 0)
    reductionSources.push({
      source: 'soreness',
      setsRemoved: ctx.sorenessSetsRemoved,
    });
  if (ctx.disruptionSetsRemoved > 0)
    reductionSources.push({
      source: 'disruption',
      setsRemoved: ctx.disruptionSetsRemoved,
    });
  const totalSetsRemoved =
    ctx.readinessSetsRemoved +
    ctx.cyclePhaseSetsRemoved +
    ctx.sorenessSetsRemoved +
    ctx.disruptionSetsRemoved;

  return {
    sessionId,
    generatedAt: new Date(),
    mainLiftSets,
    warmupSets,
    auxiliaryWork,
    volumeModifier,
    intensityModifier,
    rationale: ctx.rationale,
    warnings: ctx.warnings,
    skippedMainLift: ctx.skippedMainLift,
    restRecommendations,
    ...(totalSetsRemoved > 0 && {
      volumeReductions: {
        totalSetsRemoved,
        baseSetsCount: ctx.baseSetsCount,
        sources: reductionSources,
        recoveryBlocked: ctx.inRecoveryMode,
      },
    }),
  };
}

/** Runs generateJITSession with trace instrumentation. Returns both the standard output and the trace. */
export function generateJITSessionWithTrace(input: JITInput) {
  const traceBuilder = new PrescriptionTraceBuilder();
  const output = generateJITSession(input, traceBuilder);
  const trace = traceBuilder.build({
    rationale: output.rationale,
    warnings: output.warnings,
  });
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

  const result = exercises.map((exercise) =>
    processAuxExercise({
      exercise,
      worstSoreness,
      primaryMuscles,
      weeklyVolumeToDate,
      mrvMevConfig,
      mainLiftSetCount,
      oneRmKg,
      biologicalSex,
      hasNoEquipment,
      warnings,
      primaryLift: primaryLift ?? 'squat',
    })
  );

  // No-equipment disruption: append bodyweight compensation exercises
  // The global MAX_AUX_EXERCISES=5 cap in generateJITSession prevents the combined
  // total (bodyweight + volume top-ups) from exceeding 5 non-skipped aux exercises.
  // Soreness gate removed: bodyweight (0 kg) exercises are appropriate at any soreness
  // level and are the only available modality when equipment is absent.
  if (hasNoEquipment && primaryLift) {
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
  upcomingLifts?: Lift[],
  sorenessRatings?: Partial<Record<MuscleGroup, SorenessLevel>>,
  sleepQuality?: ReadinessLevel,
  energyLevel?: ReadinessLevel,
  activeDisruptions?: TrainingDisruption[]
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
    const projected =
      weeklyVol + Math.floor(mainLiftSetCount * primaryLiftContrib);
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

  // Core priority (gh#203): no compound contributes to core, so core depends
  // entirely on aux/top-up. Raw-deficit sort would bury core behind larger
  // push/pull/hinge deficits every session. When core is in deficit, always
  // reserve a top-up slot for it alongside the highest-deficit non-core muscle.
  // Still max 2 muscles.
  const coreCandidate = candidates.find((c) => c.muscle === 'core');
  const nonCore = candidates
    .filter((c) => c.muscle !== 'core')
    .sort((a, b) => b.deficit - a.deficit);
  const topCandidates = coreCandidate
    ? [coreCandidate, ...nonCore.slice(0, 1)]
    : nonCore.slice(0, 2);

  const result: AuxiliaryWork[] = [];
  const usedExercises = new Set<string>(activeAuxiliaries);
  const patternsUsed: MovementPattern[] = [];
  const muscleDeficits: Partial<Record<MuscleGroup, number>> =
    Object.fromEntries(candidates.map((c) => [c.muscle, c.deficit]));

  // Pre-compute lift exclusion sets (loop-invariant — depends only on function params)
  const upcomingLiftSet = upcomingLifts?.length
    ? new Set(upcomingLifts)
    : undefined;
  const injuredLiftSet = new Set<string>();
  if (activeDisruptions?.length) {
    for (const d of activeDisruptions) {
      if (d.disruption_type === 'injury' && d.affected_lifts) {
        for (const l of d.affected_lifts) injuredLiftSet.add(l);
      }
    }
  }

  for (const { muscle, deficit } of topCandidates) {
    const qualifying = auxiliaryPool.filter((exercise) => {
      if (usedExercises.has(exercise)) return false;
      if (getExerciseType(exercise) === 'timed') return false;
      const exerciseLift = getLiftForExercise(exercise);
      if (upcomingLiftSet && exerciseLift && upcomingLiftSet.has(exerciseLift))
        return false;
      if (injuredLiftSet.size > 0 && exerciseLift && injuredLiftSet.has(exerciseLift))
        return false;
      return getMusclesForExercise(exercise).some(
        (m) => m.muscle === muscle && m.contribution >= 1.0
      );
    });
    if (qualifying.length === 0) continue;

    // Rank qualifying exercises by context-aware scoring
    const ranked = rankExercises(qualifying, {
      targetMuscle: muscle,
      muscleDeficits,
      sorenessRatings: sorenessRatings ?? {},
      sleepQuality,
      energyLevel,
      primaryLift,
      mainLiftSetCount,
      upcomingLifts,
      alreadySelectedPatterns: patternsUsed,
      alreadySelectedExercises: [...usedExercises],
      biologicalSex,
    });
    const exercise = ranked[0].exercise;
    usedExercises.add(exercise);
    const entry = CATALOG_BY_NAME.get(exercise);
    if (entry) patternsUsed.push(resolveMovementPattern(entry));

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
            computeAuxWeight({
              exercise,
              oneRmKg: effectiveOneRmKg,
              lift: exerciseLift ?? primaryLift,
              biologicalSex,
            })
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
