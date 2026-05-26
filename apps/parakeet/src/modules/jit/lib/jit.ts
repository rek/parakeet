// @spec docs/features/jit-pipeline/spec-generator.md
import { getLatestMismatchDirection } from '@modules/body-review';
import { getCurrentCycleContext } from '@modules/cycle-tracking';
import { getFormulaConfig } from '@modules/formula';
import {
  getActiveAssignments,
  getAllAuxMuscleMap,
  getAllAuxTypeMap,
  getAuxiliaryPool,
  getAuxiliaryPools,
  getCurrentOneRmKg,
} from '@modules/program';
import {
  getDaysSinceLastSession,
  getProfileSex,
  getSession,
  parsePlannedSetsJson as parsePlannedSets,
} from '@modules/session';
import {
  getBarWeightKg,
  getDisabledPlates,
  getJITStrategyOverride,
  getUserRestOverrides,
  getWarmupConfig,
} from '@modules/settings';
import { getActiveRehabCapForLift } from '@modules/rehab-mode';
import { getMrvMevConfig } from '@modules/training-volume';
import {
  BlockNumberSchema,
  DisruptionSchema,
  IntensityTypeSchema,
  LiftSchema,
} from '@parakeet/shared-types';
import type { IntensityType, Lift } from '@parakeet/shared-types';
import {
  computeDivergence,
  computeInjurySorenessOverrides,
  computeWeightDeviation,
  computeWorkingOneRm,
  createAdHocJITOutput,
  createEmptyTrace,
  createMuscleMapper,
  DEFAULT_AUXILIARY_POOLS,
  DEFAULT_CORE_POOL,
  generateJITSessionWithTrace,
  getAuxiliariesForBlock,
  getJITGenerator,
  LIFTS,
  mergeSorenessRatings,
  plateIncrementKg,
  reviewJITDecision,
  rpeSetMultiplier,
} from '@parakeet/training-engine';
import type {
  CyclePhase,
  JITInput,
  JITOutput,
  MuscleGroup,
  PrescriptionTrace,
  ReadinessLevel,
  RecentSessionSummary,
  SorenessLevel,
} from '@parakeet/training-engine';
import { toJson } from '@platform/supabase';
import { captureException } from '@platform/utils/captureException';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_RPE_TARGET } from '@shared/constants/training';
import { weightGramsToKg } from '@shared/utils/weight';

import { fetchModifierCalibrations } from '../data/calibration.repository';

import {
  fetchActiveDisruptions,
  fetchAuxHistory,
  fetchJitProfile,
  fetchProgramWeekInfo,
  fetchRecentAuxExerciseNames,
  fetchRecentSessionLogsForLift,
  fetchUpcomingSessionLifts,
  fetchWeeklySessionLogs,
  fetchWeekSessionCounts,
  insertChallengeReview,
  insertComparisonLog,
  updateSessionJitOutput,
} from '../data/jit.repository';
import { estimateOneRmKgFromProfile } from './max-estimation';

// Re-export so screens import ReadinessLevel from @modules/jit.
export type { ReadinessLevel };

type Session = Awaited<ReturnType<typeof getSession>>;

function deriveBlockFromIntensity(intensityType: IntensityType): 1 | 2 | 3 {
  if (intensityType === 'heavy') return 1;
  if (intensityType === 'explosive') return 2;
  return 3;
}

export async function runJITForSession(
  session: NonNullable<Session>,
  userId: string,
  sorenessRatings: Partial<Record<MuscleGroup, SorenessLevel>>,
  sleepQuality?: ReadinessLevel,
  energyLevel?: ReadinessLevel,
  /** Optional: pass cycle phase from the UI layer to avoid a double-fetch.
   *  If not provided, jit.ts will fetch it internally for female users. */
  cyclePhaseOverride?: CyclePhase
): Promise<{ output: JITOutput; trace: PrescriptionTrace }> {
  // Free-form ad-hoc sessions have no primary lift — return empty JIT output
  if (!session.primary_lift) {
    return { output: createAdHocJITOutput(), trace: createEmptyTrace() };
  }

  const lift = LiftSchema.parse(session.primary_lift);
  const intensityType = IntensityTypeSchema.parse(session.intensity_type);

  // Ad-hoc sessions (no program) have a null block_number by design.
  // Programmatic deload sessions are also written with block_number=null by
  // the program generator (program-generator.ts:62), which crashed the JIT
  // pipeline via BlockNumberSchema.parse(null) — Sentry react-native#122700262.
  // Derive the block from intensity_type in either case.
  const isAdHoc = session.program_id === null;
  const blockNumber =
    session.block_number !== null
      ? BlockNumberSchema.parse(session.block_number)
      : deriveBlockFromIntensity(intensityType);
  if (!isAdHoc && session.block_number === null) {
    captureException(
      new Error(
        `JIT: programmatic session ${session.id} has null block_number; ` +
          `derived block=${blockNumber} from intensity_type=${intensityType}`
      )
    );
  }

  const biologicalSex = await getProfileSex(userId);

  const [
    oneRmKg,
    squatOneRmKg,
    benchOneRmKg,
    deadliftOneRmKg,
    formulaConfig,
    assignments,
    warmupResult,
    userRestOverrides,
    barWeightKg,
    pool,
    allPools,
    auxMuscleMap,
    auxTypeMap,
    disabledPlates,
  ] = await Promise.all([
    getCurrentOneRmKg(userId, lift),
    getCurrentOneRmKg(userId, 'squat'),
    getCurrentOneRmKg(userId, 'bench'),
    getCurrentOneRmKg(userId, 'deadlift'),
    getFormulaConfig(userId),
    isAdHoc
      ? Promise.resolve(null)
      : getActiveAssignments(userId, session.program_id!, blockNumber),
    getWarmupConfig(userId, lift, biologicalSex),
    getUserRestOverrides(userId),
    getBarWeightKg(biologicalSex),
    getAuxiliaryPool(userId, lift),
    isAdHoc ? Promise.resolve(null) : getAuxiliaryPools(userId),
    getAllAuxMuscleMap(userId),
    getAllAuxTypeMap(userId),
    getDisabledPlates(),
  ]);

  // GH#209: smallest weight step the lifter can actually load. Used by the
  // engine to round every prescribed weight to a reachable value instead of
  // the default 2.5kg, which assumes a 1.25kg fractional plate exists.
  const weightIncrementKg = plateIncrementKg(disabledPlates);

  // Build a muscle mapper that knows about the lifter's user-defined exercises
  // (e.g. "Pec Deck"). Used below for weekly-volume attribution so customs
  // credit the muscles the lifter selected when registering them. The plain
  // `auxMuscleMap` is passed into JITInput as data so the engine can build its
  // own mapper while keeping the input fully serializable for replay.
  const customMuscleMap = auxMuscleMap as Record<string, MuscleGroup[]>;
  const customExerciseTypeMap = auxTypeMap;
  const muscleMapper = createMuscleMapper(customMuscleMap);

  const mrvMevConfig = await getMrvMevConfig(userId, biologicalSex);

  let resolvedOneRmKg = oneRmKg;
  let dateOfBirth: string | null = null;

  if (resolvedOneRmKg === null) {
    const profile = await fetchJitProfile(userId);

    const rawBodyweight = profile?.bodyweight_kg;
    const bodyweightKg =
      typeof rawBodyweight === 'number'
        ? rawBodyweight
        : typeof rawBodyweight === 'string'
          ? parseFloat(rawBodyweight)
          : null;

    dateOfBirth = profile?.date_of_birth ?? null;

    resolvedOneRmKg = estimateOneRmKgFromProfile({
      lift,
      biologicalSex: biologicalSex ?? null,
      dateOfBirth,
      bodyweightKg,
    });
  } else {
    // Fetch profile only for date_of_birth when 1RM is already known
    const profile = await fetchJitProfile(userId);
    dateOfBirth = profile?.date_of_birth ?? null;
  }

  const userAge =
    dateOfBirth != null
      ? Math.floor(
          (Date.now() - new Date(dateOfBirth).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000)
        )
      : undefined;

  const daysSinceLastSession = await getDaysSinceLastSession(userId, lift);

  // Cycle phase for female users (engine-030); use caller-provided value if available
  let cyclePhase: CyclePhase | undefined = cyclePhaseOverride;
  if (cyclePhase === undefined && biologicalSex === 'female') {
    try {
      const cycleContext = await getCurrentCycleContext(userId);
      cyclePhase = cycleContext?.phase;
    } catch (err) {
      captureException(err);
    }
  }

  // For each slot: if locked, use the stored exercise; otherwise compute from pool rotation.
  const liftAssignment = assignments?.[lift];
  const rotationDefaults = isAdHoc
    ? ([DEFAULT_AUXILIARY_POOLS[lift][0], DEFAULT_AUXILIARY_POOLS[lift][1]] as [
        string,
        string,
      ])
    : getAuxiliariesForBlock(lift, blockNumber, pool);
  const activeAuxiliaries: [string, string] = [
    liftAssignment?.exercise_1_locked
      ? liftAssignment.exercise_1
      : rotationDefaults[0],
    liftAssignment?.exercise_2_locked
      ? liftAssignment.exercise_2
      : rotationDefaults[1],
  ];

  const [recentData, recentAuxExercises, activeRehabCapRow] = await Promise.all([
    fetchRecentSessionLogsForLift(userId, lift, 6),
    // 4 sessions ≈ slightly more than one full S/B/D rotation; scorer
    // penalty decays linearly so older entries clear naturally (GH#211).
    fetchRecentAuxExerciseNames(userId, 4),
    // Rehab Mode (GH#220): active cap for the current lift, if any. Null when
    // no cap is active; the engine treats null/undefined the same.
    getActiveRehabCapForLift(userId, lift),
  ]);
  const activeRehabCap = activeRehabCapRow
    ? { lift, capKg: Number(activeRehabCapRow.cap_kg) }
    : undefined;

  const recentLogs: RecentSessionSummary[] = recentData.map((r) => {
    let deviation: ReturnType<typeof computeWeightDeviation> = null;
    try {
      const planned = parsePlannedSets(r.planned_sets);
      const actual = r.actual_sets;
      if (planned.length > 0 && actual.length > 0) {
        deviation = computeWeightDeviation({
          plannedWeightKg: planned[0].weight_kg,
          // Tag every set with the session-level `containedRehabSets` so the
          // engine's working-1RM filter excludes them (GH#220). Per-set
          // `painLimited` would be granular, but the UI only surfaces the
          // pain-limited toggle while a cap is active anyway — session-level
          // is sufficient and avoids plumbing the flag through ActualSet JSON.
          actualSets: actual.map((s) => ({
            weightKg: weightGramsToKg(s.weight_grams),
            reps: s.reps_completed,
            rpe: s.rpe_actual,
            ...(r.containedRehabSets && { duringRehab: true }),
          })),
        });
      }
    } catch (err) {
      captureException(err);
    }
    return {
      actual_rpe: r.session_rpe ?? null,
      target_rpe: DEFAULT_RPE_TARGET,
      ...(deviation && {
        plannedWeightKg: deviation.plannedWeightKg,
        actualMaxWeightKg: deviation.actualMaxWeightKg,
        deviationKg: deviation.deviationKg,
        estimatedOneRmKg: deviation.estimatedOneRmKg ?? undefined,
      }),
      ...(r.containedRehabSets && { containedRehabSets: true }),
    };
  });

  // For ad-hoc sessions, skip program-week volume — no cycle context.
  const weeklyVolumeToDate: Partial<Record<MuscleGroup, number>> = {};
  let sessionIndex: number | undefined;
  let totalSessionsThisWeek: number | undefined;

  let upcomingLifts: Lift[] | undefined;

  if (!isAdHoc) {
    const [weekLogs, weekCounts, weekInfo, rawUpcomingLifts] =
      await Promise.all([
        fetchWeeklySessionLogs(
          userId,
          session.program_id!,
          session.week_number
        ),
        fetchWeekSessionCounts(session.program_id!, session.week_number),
        fetchProgramWeekInfo(session.program_id!),
        fetchUpcomingSessionLifts(
          session.program_id!,
          session.week_number,
          session.day_number
        ),
      ]);
    upcomingLifts = rawUpcomingLifts
      .map((l) => LiftSchema.safeParse(l).data)
      .filter((l): l is Lift => l !== undefined);

    for (const log of weekLogs) {
      const joinedSession = Array.isArray(log.sessions)
        ? log.sessions[0]
        : log.sessions;
      const rawLift = joinedSession?.primary_lift;
      const logLift = LiftSchema.safeParse(rawLift).data;
      if (!logLift) continue;

      // Main lift sets — sum RPE-scaled effective sets
      const mainEffective = log.actual_sets.reduce(
        (sum, s) => sum + rpeSetMultiplier(s.rpe_actual),
        0
      );
      const mainMuscles = muscleMapper(logLift);
      for (const { muscle, contribution } of mainMuscles) {
        weeklyVolumeToDate[muscle] =
          (weeklyVolumeToDate[muscle] ?? 0) +
          Math.floor(mainEffective * contribution);
      }

      // Aux sets — grouped by exercise, RPE-scaled. The mapper falls back to
      // the day's lift if the exercise is unknown and not in the user's custom
      // map, matching the previous behavior.
      const auxSets = log.auxiliary_sets;
      const auxByExercise = new Map<string, number>();
      for (const s of auxSets) {
        if (s.exercise) {
          auxByExercise.set(
            s.exercise,
            (auxByExercise.get(s.exercise) ?? 0) +
              rpeSetMultiplier(s.rpe_actual)
          );
        }
      }
      for (const [exercise, effective] of auxByExercise) {
        const muscles = muscleMapper(logLift, exercise);
        for (const { muscle, contribution } of muscles) {
          weeklyVolumeToDate[muscle] =
            (weeklyVolumeToDate[muscle] ?? 0) +
            Math.floor(effective * contribution);
        }
      }
    }

    // Compute week progress for pro-rated MEV in volume top-up
    if (weekInfo.programMode === 'unending') {
      totalSessionsThisWeek = weekInfo.trainingDaysPerWeek;
      sessionIndex =
        (weekInfo.unendingSessionCounter % weekInfo.trainingDaysPerWeek) + 1;

      // Unending programs generate sessions lazily — future sessions don't exist
      // in the DB, so fetchUpcomingSessionLifts returns []. Derive upcoming lifts
      // from the deterministic S→B→D rotation instead.
      if (upcomingLifts.length === 0 && lift) {
        const currentIdx = LIFTS.indexOf(lift);
        if (currentIdx >= 0) {
          const remainingInWeek = totalSessionsThisWeek - sessionIndex;
          const derived: Lift[] = [];
          for (let i = 1; i <= remainingInWeek; i++) {
            derived.push(LIFTS[(currentIdx + i) % LIFTS.length]);
          }
          upcomingLifts = derived;
        }
      }
    } else {
      totalSessionsThisWeek = weekCounts.total;
      sessionIndex = weekCounts.completed + 1;
    }
  }

  const disruptionRows = await fetchActiveDisruptions(userId);
  const activeDisruptions = disruptionRows.map((row) =>
    DisruptionSchema.parse(row)
  );

  // Inject injury-derived soreness for muscles of affected lifts (GH#166).
  // This lets the exercise scorer naturally route around injured muscles
  // without needing a separate "safe exercises" list.
  const injuryOverrides = computeInjurySorenessOverrides(activeDisruptions);
  const mergedSorenessRatings = mergeSorenessRatings(
    sorenessRatings,
    injuryOverrides
  );

  // Merge all lift pools + user-configured core + cardio pools for widest
  // top-up selection (engine-027, #191, #211). Cardio entries are `timed`,
  // which buildVolumeTopUp filters out before scoring — they are in the pool
  // for UX/ad-hoc surfacing only, not for top-up selection.
  const auxiliaryPool = allPools
    ? [
        ...allPools.squat,
        ...allPools.bench,
        ...allPools.deadlift,
        ...allPools.core,
        ...allPools.cardio,
      ]
    : [...DEFAULT_CORE_POOL];

  // GH#221: history-anchored aux weights. Fetch recent completed sessions
  // for each plausible aux exercise (active pair + full top-up pool). The
  // engine reads this map keyed by exercise display name; the repository
  // returns one entry per session per exercise that has actual set logs.
  const auxHistoryExercises = Array.from(
    new Set([...activeAuxiliaries, ...auxiliaryPool])
  );
  const auxHistory = await fetchAuxHistory(
    userId,
    auxHistoryExercises,
    /* sessionLimit */ 3
  );

  // Per-athlete modifier calibrations (engine-041)
  const modifierCalibrations = await fetchModifierCalibrations(userId);

  // Adaptive volume calibration signals (engine-043 Phase 2)
  let capacityHistory: number[] | undefined;
  let weeklyMismatchDirection:
    | 'recovering_well'
    | 'accumulating_fatigue'
    | null
    | undefined;
  try {
    const raw = await AsyncStorage.getItem('capacity_assessments_log');
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        capacityHistory = (parsed as unknown[])
          .map((v) => (typeof v === 'number' ? v : parseInt(String(v), 10)))
          .filter((v): v is number => !isNaN(v));
      }
    }
  } catch (err) {
    captureException(err);
  }

  // Weekly body review mismatch direction for primary muscles (engine-043 Phase 3)
  try {
    const primaryMuscles =
      lift === 'squat'
        ? (['quads', 'glutes', 'lower_back'] as const)
        : lift === 'bench'
          ? (['chest', 'triceps', 'shoulders'] as const)
          : (['hamstrings', 'glutes', 'lower_back', 'upper_back'] as const);
    weeklyMismatchDirection = await getLatestMismatchDirection(
      userId,
      session.program_id,
      session.week_number > 1 ? session.week_number - 1 : session.week_number,
      [...primaryMuscles]
    );
  } catch (err) {
    captureException(err);
  }

  // Compute working 1RM from recent actual session weights (GH#98)
  const { workingOneRmKg, source: oneRmSource } = computeWorkingOneRm({
    recentEstimates: recentLogs.map((l) => ({
      estimatedOneRmKg: l.estimatedOneRmKg ?? null,
    })),
    storedOneRmKg: resolvedOneRmKg,
  });

  const jitInput: JITInput = {
    sessionId: session.id,
    weekNumber: session.week_number,
    blockNumber,
    primaryLift: lift,
    intensityType,
    oneRmKg: workingOneRmKg,
    formulaConfig,
    sorenessRatings: mergedSorenessRatings,
    weeklyVolumeToDate,
    mrvMevConfig,
    activeAuxiliaries,
    recentLogs,
    activeDisruptions,
    warmupConfig: warmupResult.protocol,
    warmupConfigExplicit: warmupResult.explicit,
    userRestOverrides,
    biologicalSex: biologicalSex ?? undefined,
    barWeightKg,
    daysSinceLastSession: daysSinceLastSession ?? undefined,
    userAge,
    auxiliaryPool,
    allOneRmKg: {
      ...(squatOneRmKg != null && { squat: squatOneRmKg }),
      ...(benchOneRmKg != null && { bench: benchOneRmKg }),
      ...(deadliftOneRmKg != null && { deadlift: deadliftOneRmKg }),
    },
    sleepQuality,
    energyLevel,
    weightIncrementKg,
    recentAuxExercises: recentAuxExercises.length > 0 ? recentAuxExercises : undefined,
    cyclePhase,
    sessionIndex,
    totalSessionsThisWeek,
    upcomingLifts,
    modifierCalibrations:
      Object.keys(modifierCalibrations).length > 0
        ? modifierCalibrations
        : undefined,
    storedOneRmKg: oneRmSource === 'working' ? resolvedOneRmKg : undefined,
    oneRmSource,
    capacityHistory: capacityHistory?.length ? capacityHistory : undefined,
    weeklyMismatchDirection: weeklyMismatchDirection ?? undefined,
    customMuscleMap,
    customExerciseTypeMap:
      Object.keys(customExerciseTypeMap).length > 0
        ? customExerciseTypeMap
        : undefined,
    activeRehabCap,
    auxHistory: Object.keys(auxHistory).length > 0 ? auxHistory : undefined,
  };

  const strategyOverride = await getJITStrategyOverride();

  const writeComparisonLog = (
    strategyUsed: string,
    input: JITInput,
    formulaOutput: JITOutput,
    llmOutput: JITOutput,
    divergence: unknown
  ) => {
    void insertComparisonLog({
      user_id: userId,
      session_id: session.id,
      jit_input: toJson(input),
      formula_output: toJson(formulaOutput),
      llm_output: toJson(llmOutput),
      divergence: toJson(divergence),
      strategy_used: strategyUsed,
    }).catch(captureException);
  };

  // HybridJITGenerator self-logs via this callback. The pure-llm path is
  // logged separately below using the formula output we already compute for
  // the trace, so every llm-strategy session leaves a divergence record.
  const hybridLogger = (
    input: JITInput,
    formulaOutput: JITOutput,
    llmOutput: JITOutput,
    divergence: unknown
  ) => writeComparisonLog('hybrid', input, formulaOutput, llmOutput, divergence);

  const generator = getJITGenerator(strategyOverride, true, hybridLogger);
  const jitOutput = await generator.generate(jitInput);

  // Generate prescription trace from the same inputs. Re-runs the formula path
  // regardless of which strategy produced jitOutput — the trace explains the
  // deterministic formula reasoning. Cost: one extra formula pass (~1ms).
  const { output: formulaOutput, trace } = generateJITSessionWithTrace(jitInput);
  if (jitOutput.jit_strategy) {
    trace.strategy = jitOutput.jit_strategy;
  }

  // Log divergence for pure-llm strategy (hybrid self-logs via hybridLogger
  // above; formula strategy has no LLM output to compare). When the LLM path
  // fell back to formula, persist a zero-divergence row tagged accordingly
  // so the telemetry distinguishes "LLM agreed" from "LLM unavailable".
  if (generator.name === 'llm') {
    const fellBack = jitOutput.jit_strategy === 'formula_fallback';

    // Surface LLM regressions vs formula in the trace so they're visible in
    // JITLogs and stored on the session row. Threshold: any set drop, or
    // ≥5% main-lift weight reduction. Formula's mainLift already reflects
    // volume_calibration etc., so this catches the LLM silently undoing it.
    if (!fellBack) {
      const formulaSetCount = formulaOutput.mainLiftSets.length;
      const llmSetCount = jitOutput.mainLiftSets.length;
      if (llmSetCount < formulaSetCount) {
        trace.warnings.push(
          `LLM reduced main-lift volume from ${formulaSetCount} to ${llmSetCount} set(s) vs formula calibration`
        );
      }
      const formulaWeight = formulaOutput.mainLiftSets[0]?.weight_kg ?? 0;
      const llmWeight = jitOutput.mainLiftSets[0]?.weight_kg ?? 0;
      if (formulaWeight > 0 && llmWeight < formulaWeight * 0.95) {
        const pctDrop = Math.round((1 - llmWeight / formulaWeight) * 100);
        trace.warnings.push(
          `LLM reduced main-lift weight ${pctDrop}% vs formula baseline (${formulaWeight}kg → ${llmWeight}kg)`
        );
      }
    }

    const divergence = fellBack
      ? { weightPct: 0, setDelta: 0, rpeContextSummary: 'LLM_FALLBACK' }
      : computeDivergence(formulaOutput, jitOutput);
    writeComparisonLog(
      fellBack ? 'formula_fallback' : 'llm',
      jitInput,
      formulaOutput,
      jitOutput,
      divergence
    );
  }

  // Finding #15: re-running JIT used to silently overwrite the disruption-
  // applied planned_sets with a smaller-or-equal reduction. With the engine
  // step now reading the canonical reduction_pct from suggestDisruptionAdjustment
  // (finding #1), the pipeline reproduces the stored adjusted weights — the
  // overwrite is therefore a composition of the same reduction, not a loss.
  // No explicit short-circuit is needed.
  await updateSessionJitOutput(session.id, {
    planned_sets: toJson(jitOutput.mainLiftSets),
    jit_generated_at: jitOutput.generatedAt.toISOString(),
    jit_strategy: jitOutput.jit_strategy ?? generator.name,
    jit_input_snapshot: toJson(jitInput),
    jit_output_trace: toJson(trace),
  });

  // Fire-and-forget: async judge review (runs during warmup)
  reviewJITDecision(jitInput, jitOutput)
    .then((review) =>
      insertChallengeReview({
        user_id: userId,
        session_id: session.id,
        score: review.score,
        verdict: review.verdict,
        concerns: toJson(review.concerns),
        suggested_overrides: review.suggestedOverrides
          ? toJson(review.suggestedOverrides)
          : null,
      })
    )
    .catch(captureException);

  return { output: jitOutput, trace };
}
