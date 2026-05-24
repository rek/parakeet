import {
  IntensityType,
  Lift,
  PlannedSet,
  TrainingDisruption,
} from '@parakeet/shared-types';

import { ReadinessLevel } from '../adjustments/readiness-adjuster';
import {
  getPrimaryMusclesForSession,
  SorenessLevel,
  SorenessModifier,
} from '../adjustments/soreness-adjuster';
import {
  AuxAnchorCarrier,
  AuxAnchorResult,
  AuxHistoryEntry,
  computeAuxAnchor,
  toAnchorCarrier,
} from '../auxiliary/anchor';
import {
  computeAuxWeight,
  getBodyweightPool,
  getCatalogEntry,
  getLiftForExercise,
  getRepTarget,
  MovementPattern,
  resolveMovementPattern,
  slugify,
} from '../auxiliary/exercise-catalog';
import { rankExercises } from '../auxiliary/exercise-scorer';
import {
  createExerciseTyper,
  CustomExerciseTypeMap,
  ExerciseType,
  getExerciseType,
} from '../auxiliary/exercise-types';
import { CyclePhase } from '../formulas/cycle-phase';
import { roundToNearest } from '../formulas/weight-rounding';
import {
  FormulaConfig,
  MrvMevConfig,
  MuscleGroup,
  MuscleMapper,
  PUSH_MUSCLES,
  type ActiveRehabCap,
} from '../types';
import {
  createMuscleMapper,
  CustomMuscleMap,
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
  /** True when the session contained any set logged under an active rehab
   *  cap (GH#220). Even after the cap is lifted, those sessions' RPE is
   *  pain-ambiguous and the weight was capped — they must not drive Steps
   *  0/2/2b auto-progression on the next clean session. App layer computes
   *  this from `set_logs.during_rehab` when assembling JITInput. */
  containedRehabSets?: boolean;
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
  // Subjective readiness signals (engine-028).
  // 1–5 scale: 1=Drained/Terrible, 2=Low/Poor, 3=OK (neutral), 4=Good, 5=High/Great.
  // Engine reads raw — see `readiness-adjuster.ts` for adjustment bands.
  sleepQuality?: ReadinessLevel;
  energyLevel?: ReadinessLevel;
  /** Smallest weight increment the lifter can actually load on the bar.
   *  Derived from the user's available plate set (see `plateIncrementKg`
   *  in `formulas/weight-rounding.ts`). Engine rounds all prescribed weights
   *  to this increment so e.g. 52.5kg is never prescribed when 1.25kg plates
   *  are disabled. Defaults to `formulaConfig.rounding_increment_kg` when
   *  undefined; the more restrictive of the two wins. See GH#209. */
  weightIncrementKg?: number;
  /** Auxiliary exercise names from recent sessions, ordered newest-first.
   *  Drives the recency-penalty factor in the auxiliary scorer so the same
   *  core/aux exercise isn't deterministically chosen every session when
   *  other signals (deficit, soreness, specificity) don't break the tie.
   *  See GH#211. */
  recentAuxExercises?: string[];
  // Wearable recovery signals — supersede sleepQuality/energyLevel when present.
  // All optional; partial data is normal. Populated from today's recovery_snapshots row.
  // See spec-pipeline.md §10 and spec-readiness-adjuster.md §3.
  hrvPctChange?: number;
  restingHrPctChange?: number;
  sleepDurationMin?: number;
  deepSleepPct?: number;
  spo2Avg?: number;
  nonTrainingLoad?: number;
  readinessScore?: number;
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
  // User-defined exercises (e.g. "Pec Deck") and the muscles the lifter
  // selected when registering them. Used by the engine to credit volume to
  // those muscles for exercises that aren't in the catalog. Catalog entries
  // always take priority. Kept as plain data so JITInput stays serializable
  // (used for replay/diagnostics in jit_input columns).
  customMuscleMap?: CustomMuscleMap;
  // User-defined exercise types (e.g. "Running" → 'timed'). Captured from the
  // type-picker step in AddExerciseModal and stored on auxiliary_exercises.
  // Catalog wins over this map; only used for names not in the catalog.
  customExerciseTypeMap?: CustomExerciseTypeMap;
  /** Active rehab cap for this session's primary lift, when one exists
   *  (GH#220). When present, the engine clamps the final weight to capKg
   *  (rounded UP to plate increment), suppresses Steps 0/2/2b, excludes the
   *  capped lift's primary muscles from volume top-up, and exits early from
   *  intra-session weight autoregulation and volume add-back. The app layer
   *  fetches the active cap via `getActiveRehabCapForLift` and threads it
   *  into JIT input — engine remains pure. */
  activeRehabCap?: ActiveRehabCap;
  /** Per-aux-exercise recent completed sessions, keyed by exercise name
   *  (or slug — app layer normalizes). Drives the history-anchored aux
   *  weight (GH#221). When absent or empty for a given exercise, the
   *  formula path runs unchanged. Engine remains pure: app layer queries
   *  set_logs + jit_output_jsonb and passes the structured input here. */
  auxHistory?: Record<string, AuxHistoryEntry[]>;
  /** Current time as ISO string. Optional — falls back to `new Date()` at
   *  generation time. Tests use this to make stale-window decay deterministic. */
  nowIso?: string;
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
  /** History-anchor metadata (GH#221). Present whenever the engine
   *  considered an anchor for this exercise — even when source = 'formula'
   *  (e.g. no history). UI uses this to render the divergence callout.
   *  `anchorBaseKg` is the anchor weight BEFORE main-lift modifiers
   *  (readiness, cycle, soreness, intensity ratio). The note copy should
   *  use this when comparing to the formula — otherwise main-lift
   *  modifier shrinkage gets misattributed to "your recent" history. */
  anchor?: AuxAnchorCarrier;
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
  /** True when the final main-lift weight was determined by an active Rehab
   *  Mode cap rather than the formula × modifier stack (GH#220). When true,
   *  `rehabCapKg` is the cap value. The UI uses this to render a "Capped by
   *  Rehab Mode" footnote and to suppress in-session autoregulation / volume
   *  add-back prompts that would push past the cap. */
  cappedByRehab?: boolean;
  rehabCapKg?: number;
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
  const muscleMapper = createMuscleMapper(input.customMuscleMap);
  const exerciseTyper = createExerciseTyper(input.customExerciseTypeMap);

  // Step 1 — Initialize pipeline context (base sets, primary muscles, soreness)
  const ctx = initPipeline(input, traceBuilder);

  // Capture the formula-derived base set count BEFORE Step 0 mutates it.
  // Finding #11: volumeModifier/auxVolumeRatio compare final sets against
  // the FORMULA baseline so penalty propagation reflects the true reduction
  // — not the post-calibration baseline (which already absorbed +N sets from
  // adaptive volume).
  const formulaBaseSetsCount = ctx.baseSets.length;

  // Step 0 — Adaptive volume calibration (can increase or decrease base set count)
  applyVolumeCalibration(ctx, input, traceBuilder);

  // Steps 2–7 — Modifier pipeline (each step mutates ctx, can only reduce)
  applyRpeAdjustment(ctx, input, traceBuilder);
  applyRepRangeAdjustment(ctx, input, traceBuilder);
  applyReadinessAdjustment(ctx, input, traceBuilder);
  applyCyclePhaseAdjustment(ctx, input, traceBuilder);
  applySorenessAdjustment(ctx, input, traceBuilder);
  applyMrvCap(ctx, input, traceBuilder);
  applyDisruptionAdjustment(ctx, input, traceBuilder);

  // Step 7 — Final main lift sets
  const mainLiftSets = buildFinalMainSets(ctx, input, traceBuilder);

  const volumeModifier =
    formulaBaseSetsCount > 0 ? mainLiftSets.length / formulaBaseSetsCount : 1.0;
  const intensityModifier = ctx.inRecoveryMode ? 0.4 : ctx.intensityMultiplier;

  // Step 6 — Auxiliary work
  // Deload sessions are recovery weeks — soreness should not further suppress aux volume,
  // and the proportional modifier propagation (GH#217) is bypassed since deload modifiers
  // are intentionally already baked into the base prescription.
  const isDeload = input.intensityType === 'deload';
  // equipment_unavailable disruption deliberately reduces main and boosts aux as
  // bodyweight compensation; the proportional propagation would invert that intent
  // by also cutting aux. The +1 set logic + bodyweight pool handle this case.
  const hasEquipmentDisruption =
    input.activeDisruptions?.some(
      (d) => d.disruption_type === 'equipment_unavailable'
    ) ?? false;
  const auxSoreness = isDeload ? (1 as SorenessLevel) : ctx.worstSoreness;
  const auxVolumeRatio =
    isDeload || hasEquipmentDisruption
      ? 1
      : formulaBaseSetsCount > 0
        ? ctx.plannedCount / formulaBaseSetsCount
        : 1;
  const auxIntensityRatio =
    isDeload || hasEquipmentDisruption ? 1 : ctx.intensityMultiplier;
  const auxiliaryWork = buildAuxiliaryWork(
    activeAuxiliaries,
    oneRmKg,
    mainLiftSets.length,
    input.weeklyVolumeToDate,
    input.mrvMevConfig,
    ctx.primaryMuscles,
    auxSoreness,
    ctx.warnings,
    muscleMapper,
    input.biologicalSex,
    input.activeDisruptions,
    primaryLift,
    input.weightIncrementKg,
    exerciseTyper,
    auxVolumeRatio,
    auxIntensityRatio,
    ctx.skippedMainLift,
    input.intensityType,
    input.auxHistory,
    input.nowIso ?? new Date().toISOString()
  );

  // Step 6b — Volume top-up (engine-027): append exercises for under-MEV muscles
  // Cap at MAX_AUX_EXERCISES to keep total session exercises ≤ 6 (5 aux + 1 main lift)
  if (input.auxiliaryPool && input.auxiliaryPool.length > 0) {
    const topUps = buildVolumeTopUp(
      input.auxiliaryPool,
      primaryLift,
      oneRmKg,
      mainLiftSets.length,
      input.weeklyVolumeToDate,
      input.mrvMevConfig,
      activeAuxiliaries,
      muscleMapper,
      input.biologicalSex,
      input.sessionIndex,
      input.totalSessionsThisWeek,
      input.allOneRmKg,
      input.upcomingLifts,
      input.sorenessRatings,
      input.sleepQuality,
      input.energyLevel,
      input.activeDisruptions,
      input.weightIncrementKg,
      input.recentAuxExercises,
      exerciseTyper,
      input.auxHistory,
      input.nowIso ?? new Date().toISOString()
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
        // AuxAnchorTrace = Omit<AuxAnchorCarrier, 'rationale'> — listing the
        // fields explicitly so a new carrier field that should flow into the
        // trace fails typecheck here until added.
        anchor: aux.anchor
          ? {
              source: aux.anchor.source,
              confidence: aux.anchor.confidence,
              sessionsUsed: aux.anchor.sessionsUsed,
              formulaWeightKg: aux.anchor.formulaWeightKg,
              anchorBaseKg: aux.anchor.anchorBaseKg,
            }
          : undefined,
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
      barWeightKg,
      input.weightIncrementKg
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
    ...(ctx.cappedByRehab && ctx.rehabCapKg !== null
      ? { cappedByRehab: true, rehabCapKg: ctx.rehabCapKg }
      : {}),
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

/**
 * Resolve the history-anchor for one aux exercise. The app layer keys
 * `auxHistory` by canonical catalog slug (so renames don't break matching);
 * we also accept display-name keys for in-engine callers that haven't been
 * updated. Returns undefined when no anchor input is available —
 * processAuxExercise then runs the formula path unchanged.
 */
function resolveAuxAnchor(
  exercise: string,
  formulaWeightKg: number,
  auxHistory: Record<string, AuxHistoryEntry[]> | undefined,
  nowIso: string
): AuxAnchorResult | undefined {
  if (!auxHistory) return undefined;
  const slug = getCatalogEntry(exercise)?.slug ?? slugify(exercise);
  const history = auxHistory[slug] ?? auxHistory[exercise] ?? [];
  if (history.length === 0) return undefined;
  return computeAuxAnchor({ formulaWeightKg, history, nowIso });
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
  muscleMapper: MuscleMapper,
  biologicalSex?: 'female' | 'male',
  activeDisruptions?: TrainingDisruption[],
  primaryLift?: Lift,
  weightIncrementKg?: number,
  exerciseTyper: (name: string) => ExerciseType = getExerciseType,
  mainLiftVolumeRatio = 1,
  mainIntensityMultiplier = 1,
  skippedMainLift = false,
  intensityType: IntensityType = 'heavy',
  auxHistory?: Record<string, AuxHistoryEntry[]>,
  nowIso: string = new Date().toISOString()
): AuxiliaryWork[] {
  const hasNoEquipment =
    activeDisruptions?.some(
      (d) => d.disruption_type === 'equipment_unavailable'
    ) ?? false;

  const result = exercises.map((exercise) => {
    const formulaWeightKg = computeAuxWeight({
      exercise,
      oneRmKg,
      lift: primaryLift ?? 'squat',
      biologicalSex,
    });
    const anchorResult = resolveAuxAnchor(
      exercise,
      formulaWeightKg,
      auxHistory,
      nowIso
    );
    return processAuxExercise({
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
      muscleMapper,
      weightIncrementKg,
      exerciseTyper,
      mainLiftVolumeRatio,
      mainIntensityMultiplier,
      skippedMainLift,
      intensityType,
      anchorResult,
    });
  });

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
/** Cap session exercises at 6 total (5 aux + 1 main lift). Used to size the
 *  volume top-up output so it never blows past this ceiling regardless of
 *  which strategy (formula | llm | hybrid) generated the base aux list. */
export const MAX_AUX_EXERCISES = 5;

export function buildVolumeTopUp(
  auxiliaryPool: string[],
  primaryLift: Lift,
  oneRmKg: number,
  mainLiftSetCount: number,
  weeklyVolumeToDate: Partial<Record<MuscleGroup, number>>,
  mrvMevConfig: MrvMevConfig,
  activeAuxiliaries: [string, string],
  muscleMapper: MuscleMapper,
  biologicalSex?: 'female' | 'male',
  sessionIndex?: number,
  totalSessionsThisWeek?: number,
  allOneRmKg?: Partial<Record<Lift, number>>,
  upcomingLifts?: Lift[],
  sorenessRatings?: Partial<Record<MuscleGroup, SorenessLevel>>,
  sleepQuality?: ReadinessLevel,
  energyLevel?: ReadinessLevel,
  activeDisruptions?: TrainingDisruption[],
  weightIncrementKg = 2.5,
  recentAuxExercises?: string[],
  // Falls back to catalog-only resolution when the caller hasn't built a
  // user-aware typer. Engine internal callers always pass a real typer.
  exerciseTyper: (name: string) => ExerciseType = getExerciseType,
  // GH#221: per-aux history for anchor computation on top-up picks.
  auxHistory?: Record<string, AuxHistoryEntry[]>,
  nowIso: string = new Date().toISOString()
): AuxiliaryWork[] {
  // Build main lift muscle contributions to project post-session volume
  const liftMuscles = muscleMapper(primaryLift);
  const mainContrib = new Map<MuscleGroup, number>();
  for (const { muscle, contribution } of liftMuscles) {
    mainContrib.set(muscle, (mainContrib.get(muscle) ?? 0) + contribution);
  }

  // GH#217: never top up the primary muscles of today's main lift. The lifter
  // is already training those muscles; reactive top-up creates redundant work
  // (e.g. chest top-up on bench day) and undoes penalty reductions that just
  // cut the main lift. If the program wants more of that muscle, it belongs in
  // the program template, not the top-up.
  const primaryMusclesToday = new Set(getPrimaryMusclesForSession(primaryLift));

  // Find muscles below MEV after factoring in today's main lift
  const candidates: Array<{ muscle: MuscleGroup; deficit: number }> = [];
  for (const muscle of Object.keys(mrvMevConfig) as MuscleGroup[]) {
    if (primaryMusclesToday.has(muscle)) continue;
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
  // Finding #16: track sets already booked by previous top-up iterations
  // against EACH muscle (including overlapping contributions ≥ 1.0). The
  // per-iteration remainingMrv calc must include this so two top-ups that
  // hit overlapping muscles don't double-book the same MRV headroom.
  const topUpVolumeByMuscle: Partial<Record<MuscleGroup, number>> = {};

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
      if (exerciseTyper(exercise) === 'timed') return false;
      const exerciseLift = getLiftForExercise(exercise);
      if (upcomingLiftSet && exerciseLift && upcomingLiftSet.has(exerciseLift))
        return false;
      if (injuredLiftSet.size > 0 && exerciseLift && injuredLiftSet.has(exerciseLift))
        return false;
      return muscleMapper(null, exercise).some(
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
      muscleMapper,
      primaryLift,
      mainLiftSetCount,
      upcomingLifts,
      alreadySelectedPatterns: patternsUsed,
      alreadySelectedExercises: [...usedExercises],
      recentAuxExercises,
      biologicalSex,
    });
    const exercise = ranked[0].exercise;
    usedExercises.add(exercise);
    const entry = getCatalogEntry(exercise);
    if (entry) patternsUsed.push(resolveMovementPattern(entry));

    const exerciseType = exerciseTyper(exercise);
    const remainingMrv =
      mrvMevConfig[muscle].mrv -
      (weeklyVolumeToDate[muscle] ?? 0) -
      (topUpVolumeByMuscle[muscle] ?? 0);
    const setCount = Math.max(1, Math.min(3, deficit, remainingMrv));

    // Book this top-up's contribution against ALL muscles it hits (≥ 1.0).
    // Without this, two top-ups targeting overlapping muscles (e.g. both
    // contribute 1.0 to upper_back) would each see the unmodified
    // weeklyVolumeToDate and double-book MRV headroom.
    const exerciseMuscles = muscleMapper(null, exercise);
    for (const { muscle: m, contribution } of exerciseMuscles) {
      if (contribution >= 1.0) {
        topUpVolumeByMuscle[m] = (topUpVolumeByMuscle[m] ?? 0) + setCount;
      }
    }

    const baseReps = biologicalSex === 'female' ? 12 : 10;
    const reps = getRepTarget(exercise, baseReps);
    const exerciseLift = getLiftForExercise(exercise);
    const effectiveOneRmKg =
      exerciseLift && allOneRmKg?.[exerciseLift] != null
        ? allOneRmKg[exerciseLift]!
        : oneRmKg;
    const formulaWeightKg =
      exerciseType === 'bodyweight'
        ? 0
        : computeAuxWeight({
            exercise,
            oneRmKg: effectiveOneRmKg,
            lift: exerciseLift ?? primaryLift,
            biologicalSex,
          });
    // GH#221: top-up picks also honor the history anchor when one exists.
    const anchorResult =
      exerciseType === 'bodyweight'
        ? undefined
        : resolveAuxAnchor(exercise, formulaWeightKg, auxHistory, nowIso);
    const useAnchorWeight =
      anchorResult != null && anchorResult.source !== 'formula';
    const finalWeight =
      exerciseType === 'bodyweight'
        ? 0
        : roundToNearest(
            useAnchorWeight ? anchorResult.anchorKg : formulaWeightKg,
            weightIncrementKg
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
      anchor: anchorResult ? toAnchorCarrier(anchorResult) : undefined,
    });
  }

  return result;
}

// Re-export SorenessModifier so callers don't need a separate import
export type { SorenessModifier };
