import { getLatestMismatchDirection } from '@modules/body-review';
import { getCurrentCycleContext } from '@modules/cycle-tracking';
import { getFormulaConfig } from '@modules/formula/application/formula.service';
import {
  getActiveAssignments,
  getAuxiliaryPool,
  getAuxiliaryPools,
} from '@modules/program/lib/auxiliary-config';
import { getCurrentOneRmKg } from '@modules/program/lib/lifter-maxes';
import {
  parseActualSetsJson,
  parsePlannedSetsJson as parsePlannedSets,
} from '@modules/session';
import {
  getDaysSinceLastSession,
  getSession,
} from '@modules/session/application/session.service';
import { fetchProfileSex } from '@modules/session/data/session.repository';
import { getUserRestOverrides } from '@modules/settings/lib/rest-config';
import {
  getBarWeightKg,
  getJITStrategyOverride,
} from '@modules/settings/lib/settings';
import { getWarmupConfig } from '@modules/settings/lib/warmup-config';
import { getMrvMevConfig } from '@modules/training-volume/lib/volume-config';
import {
  BlockNumberSchema,
  DisruptionSchema,
  IntensityTypeSchema,
  LiftSchema,
} from '@parakeet/shared-types';
import type { Lift } from '@parakeet/shared-types';
import {
  computeWeightDeviation,
  computeWorkingOneRm,
  createAdHocJITOutput,
  createEmptyTrace,
  DEFAULT_AUXILIARY_POOLS,
  generateJITSessionWithTrace,
  getAuxiliariesForBlock,
  getJITGenerator,
  getMusclesForExercise,
  getMusclesForLift,
  LIFTS,
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
import { toJson, typedSupabase } from '@platform/supabase';
import { captureException } from '@platform/utils/captureException';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_RPE_TARGET } from '@shared/constants/training';
import { weightGramsToKg } from '@shared/utils/weight';

import { fetchModifierCalibrations } from '../data/calibration.repository';
import {
  fetchActiveDisruptions,
  fetchJitProfile,
  fetchProgramWeekInfo,
  fetchRecentSessionLogsForLift,
  fetchUpcomingSessionLifts,
  fetchWeeklySessionLogs,
  fetchWeekSessionCounts,
} from '../data/jit.repository';
import { estimateOneRmKgFromProfile } from './max-estimation';

// Re-export so screens import ReadinessLevel from @modules/jit.
export type { ReadinessLevel };

type Session = Awaited<ReturnType<typeof getSession>>;

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

  // For ad-hoc sessions (no program), derive block number from intensity type
  const isAdHoc = session.program_id === null;
  const blockNumber = isAdHoc
    ? intensityType === 'heavy'
      ? 1
      : intensityType === 'explosive'
        ? 2
        : 3
    : BlockNumberSchema.parse(session.block_number);

  const biologicalSex = await fetchProfileSex(userId);

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
  ]);

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
    } catch {
      // non-fatal — cycle phase adjustment is best-effort
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

  const recentData = await fetchRecentSessionLogsForLift(userId, lift, 6);

  const recentLogs: RecentSessionSummary[] = recentData.map((r) => {
    let deviation: ReturnType<typeof computeWeightDeviation> = null;
    try {
      const planned = parsePlannedSets(r.planned_sets);
      const actual = parseActualSetsJson(r.actual_sets);
      if (planned.length > 0 && actual.length > 0) {
        deviation = computeWeightDeviation({
          plannedWeightKg: planned[0].weight_kg,
          actualSets: actual.map((s) => ({
            weightKg: weightGramsToKg(s.weight_grams),
            reps: s.reps_completed,
            rpe: s.rpe_actual,
          })),
        });
      }
    } catch {
      // Non-fatal: older sessions may lack planned_sets or have malformed JSONB
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
      type SetWithRpe = { rpe_actual?: number };
      const mainSets = Array.isArray(log.actual_sets)
        ? (log.actual_sets as SetWithRpe[])
        : [];
      const mainEffective = mainSets.reduce(
        (sum, s) => sum + rpeSetMultiplier(s.rpe_actual),
        0
      );
      const mainMuscles = getMusclesForLift(logLift);
      for (const { muscle, contribution } of mainMuscles) {
        weeklyVolumeToDate[muscle] =
          (weeklyVolumeToDate[muscle] ?? 0) +
          Math.floor(mainEffective * contribution);
      }

      // Aux sets — grouped by exercise, RPE-scaled
      const auxSets = Array.isArray(log.auxiliary_sets)
        ? (log.auxiliary_sets as { exercise?: string; rpe_actual?: number }[])
        : [];
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
        const auxMuscles = getMusclesForExercise(exercise);
        const muscles =
          auxMuscles.length > 0 ? auxMuscles : getMusclesForLift(logLift);
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

  // Merge all three lift pools for widest top-up selection (engine-027)
  const auxiliaryPool = allPools
    ? [...allPools.squat, ...allPools.bench, ...allPools.deadlift]
    : [];

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
    // Fetch recent capacity assessments from AsyncStorage.
    // Keys are stored as capacity_assessment:<sessionId> — order doesn't matter,
    // we just need the most recent values. Limit to 5 to avoid processing stale data.
    const allKeys = await AsyncStorage.getAllKeys();
    const capacityKeys = allKeys.filter((k) =>
      k.startsWith('capacity_assessment:')
    );
    if (capacityKeys.length > 0) {
      // Sort by key to approximate chronological order (UUIDs are not sortable,
      // but this is best-effort — the calibration system is robust to ordering)
      const recentKeys = capacityKeys.slice(-5);
      const entries = await AsyncStorage.multiGet(recentKeys);
      capacityHistory = entries
        .map(([, v]) => (v ? parseInt(v, 10) : null))
        .filter((v): v is number => v !== null && !isNaN(v));
    }
  } catch {
    // Non-critical — volume calibration degrades gracefully without capacity data
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
  } catch {
    // Non-critical
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
    sorenessRatings,
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
  };

  const strategyOverride = await getJITStrategyOverride();

  const comparisonLogger = (
    input: JITInput,
    formulaOutput: JITOutput,
    llmOutput: JITOutput,
    divergence: unknown
  ) => {
    void typedSupabase
      .from('jit_comparison_logs')
      .insert([
        {
          user_id: userId,
          session_id: session.id,
          jit_input: toJson(input),
          formula_output: toJson(formulaOutput),
          llm_output: toJson(llmOutput),
          divergence: toJson(divergence),
          strategy_used: 'llm',
        },
      ])
      .then(({ error }) => {
        if (error) captureException(error);
      });
  };

  const generator = getJITGenerator(strategyOverride, true, comparisonLogger);
  const jitOutput = await generator.generate(jitInput);

  // Generate prescription trace from the same inputs. Re-runs the formula path
  // regardless of which strategy produced jitOutput — the trace explains the
  // deterministic formula reasoning. Cost: one extra formula pass (~1ms).
  const { trace } = generateJITSessionWithTrace(jitInput);
  if (jitOutput.jit_strategy) {
    trace.strategy = jitOutput.jit_strategy;
  }

  const { error: updateError } = await typedSupabase
    .from('sessions')
    .update({
      planned_sets: jitOutput.mainLiftSets,
      jit_generated_at: jitOutput.generatedAt.toISOString(),
      jit_strategy: jitOutput.jit_strategy ?? generator.name,
      jit_input_snapshot: toJson(jitInput),
      jit_output_trace: toJson(trace),
    })
    .eq('id', session.id);
  if (updateError) throw updateError;

  // Fire-and-forget: async judge review (runs during warmup)
  reviewJITDecision(jitInput, jitOutput)
    .then((review) => {
      void typedSupabase
        .from('challenge_reviews')
        .insert([
          {
            user_id: userId,
            session_id: session.id,
            score: review.score,
            verdict: review.verdict,
            concerns: toJson(review.concerns),
            suggested_overrides: review.suggestedOverrides
              ? toJson(review.suggestedOverrides)
              : null,
          },
        ])
        .then(({ error }) => {
          if (error) captureException(error);
        });
    })
    .catch(captureException);

  return { output: jitOutput, trace };
}
