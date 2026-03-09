import {
  getJITGenerator,
  getMusclesForLift,
  getMusclesForExercise,
  rpeSetMultiplier,
  DEFAULT_AUXILIARY_POOLS,
  getAuxiliariesForBlock,
  createAdHocJITOutput,
} from '@parakeet/training-engine'
import type {
  JITInput,
  JITOutput,
  SorenessLevel,
  MuscleGroup,
  RecentSessionSummary,
  ReadinessLevel,
  CyclePhase,
} from '@parakeet/training-engine'
import { getCurrentCycleContext } from '@modules/cycle-tracking'
import { LiftSchema, IntensityTypeSchema, BlockNumberSchema, DisruptionSchema } from '@parakeet/shared-types'
import { getFormulaConfig } from '@modules/formula/application/formula.service'
import { getSession, getDaysSinceLastSession } from '@modules/session/application/session.service'
import { fetchProfileSex } from '@modules/session/data/session.repository'
import { getCurrentOneRmKg } from '@modules/program/lib/lifter-maxes'
import { getActiveAssignments, getAuxiliaryPool, getAuxiliaryPools } from '@modules/program/lib/auxiliary-config'
import { getMrvMevConfig } from '@modules/training-volume/lib/volume-config'
import { getJITStrategyOverride, getBarWeightKg } from '@modules/settings/lib/settings'
import { getUserRestOverrides } from '@modules/settings/lib/rest-config'
import { getWarmupConfig } from '@modules/settings/lib/warmup-config'
import { typedSupabase, toJson } from '@platform/supabase'
import { captureException } from '@platform/utils/captureException'
import { estimateOneRmKgFromProfile } from './max-estimation'
import {
  fetchJitProfile,
  fetchRecentSessionLogsForLift,
  fetchWeeklySessionLogs,
  fetchActiveDisruptions,
  fetchWeekSessionCounts,
  fetchProgramWeekInfo,
} from '../data/jit.repository'

type Session = Awaited<ReturnType<typeof getSession>>

export async function runJITForSession(
  session: NonNullable<Session>,
  userId: string,
  sorenessRatings: Partial<Record<MuscleGroup, SorenessLevel>>,
  sleepQuality?: ReadinessLevel,
  energyLevel?: ReadinessLevel,
  /** Optional: pass cycle phase from the UI layer to avoid a double-fetch.
   *  If not provided, jit.ts will fetch it internally for female users. */
  cyclePhaseOverride?: CyclePhase,
): Promise<JITOutput> {
  // Free-form ad-hoc sessions have no primary lift — return empty JIT output
  if (!session.primary_lift) {
    return createAdHocJITOutput()
  }

  const lift = LiftSchema.parse(session.primary_lift)
  const intensityType = IntensityTypeSchema.parse(session.intensity_type)

  // For ad-hoc sessions (no program), derive block number from intensity type
  const isAdHoc = session.program_id === null
  const blockNumber = isAdHoc
    ? (intensityType === 'heavy' ? 1 : intensityType === 'explosive' ? 2 : 3)
    : BlockNumberSchema.parse(session.block_number)

  const biologicalSex = await fetchProfileSex(userId)

  const [oneRmKg, formulaConfig, assignments, warmupConfig, userRestOverrides, barWeightKg, pool, allPools] =
    await Promise.all([
      getCurrentOneRmKg(userId, lift),
      getFormulaConfig(userId),
      isAdHoc ? Promise.resolve(null) : getActiveAssignments(userId, session.program_id!, blockNumber),
      getWarmupConfig(userId, lift, biologicalSex),
      getUserRestOverrides(userId),
      getBarWeightKg(biologicalSex),
      getAuxiliaryPool(userId, lift),
      isAdHoc ? Promise.resolve(null) : getAuxiliaryPools(userId),
    ])

  const mrvMevConfig = await getMrvMevConfig(userId, biologicalSex)

  let resolvedOneRmKg = oneRmKg
  let dateOfBirth: string | null = null

  if (resolvedOneRmKg === null) {
    const profile = await fetchJitProfile(userId)

    const rawBodyweight = profile?.bodyweight_kg
    const bodyweightKg =
      typeof rawBodyweight === 'number'
        ? rawBodyweight
        : typeof rawBodyweight === 'string'
          ? parseFloat(rawBodyweight)
          : null

    dateOfBirth = profile?.date_of_birth ?? null

    resolvedOneRmKg = estimateOneRmKgFromProfile({
      lift,
      biologicalSex: biologicalSex ?? null,
      dateOfBirth,
      bodyweightKg,
    })
  } else {
    // Fetch profile only for date_of_birth when 1RM is already known
    const profile = await fetchJitProfile(userId)
    dateOfBirth = profile?.date_of_birth ?? null
  }

  const userAge =
    dateOfBirth != null
      ? Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : undefined

  const daysSinceLastSession = await getDaysSinceLastSession(userId, lift)

  // Cycle phase for female users (engine-030); use caller-provided value if available
  let cyclePhase: CyclePhase | undefined = cyclePhaseOverride
  if (cyclePhase === undefined && biologicalSex === 'female') {
    try {
      const cycleContext = await getCurrentCycleContext(userId)
      cyclePhase = cycleContext?.phase
    } catch {
      // non-fatal — cycle phase adjustment is best-effort
    }
  }

  // For each slot: if locked, use the stored exercise; otherwise compute from pool rotation.
  const liftAssignment = assignments?.[lift]
  const rotationDefaults = isAdHoc
    ? ([DEFAULT_AUXILIARY_POOLS[lift][0], DEFAULT_AUXILIARY_POOLS[lift][1]] as [string, string])
    : getAuxiliariesForBlock(lift, blockNumber, pool)
  const activeAuxiliaries: [string, string] = [
    liftAssignment?.exercise_1_locked ? liftAssignment.exercise_1 : rotationDefaults[0],
    liftAssignment?.exercise_2_locked ? liftAssignment.exercise_2 : rotationDefaults[1],
  ]

  const recentData = await fetchRecentSessionLogsForLift(userId, lift, 6)

  const recentLogs: RecentSessionSummary[] = recentData.map((r) => ({
    actual_rpe: r.session_rpe ?? null,
    target_rpe: 8.5,
  }))

  // For ad-hoc sessions, skip program-week volume — no cycle context.
  const weeklyVolumeToDate: Partial<Record<MuscleGroup, number>> = {}
  let sessionIndex: number | undefined
  let totalSessionsThisWeek: number | undefined

  if (!isAdHoc) {
    const [weekLogs, weekCounts, weekInfo] = await Promise.all([
      fetchWeeklySessionLogs(userId, session.program_id!, session.week_number),
      fetchWeekSessionCounts(session.program_id!, session.week_number),
      fetchProgramWeekInfo(session.program_id!),
    ])

    for (const log of weekLogs) {
      const joinedSession = Array.isArray(log.sessions) ? log.sessions[0] : log.sessions
      const rawLift = joinedSession?.primary_lift
      const logLift = LiftSchema.safeParse(rawLift).data
      if (!logLift) continue

      // Main lift sets — sum RPE-scaled effective sets
      type SetWithRpe = { rpe_actual?: number }
      const mainSets = Array.isArray(log.actual_sets)
        ? (log.actual_sets as SetWithRpe[])
        : []
      const mainEffective = mainSets.reduce((sum, s) => sum + rpeSetMultiplier(s.rpe_actual), 0)
      const mainMuscles = getMusclesForLift(logLift)
      for (const { muscle, contribution } of mainMuscles) {
        weeklyVolumeToDate[muscle] =
          (weeklyVolumeToDate[muscle] ?? 0) + Math.floor(mainEffective * contribution)
      }

      // Aux sets — grouped by exercise, RPE-scaled
      const auxSets = Array.isArray(log.auxiliary_sets)
        ? (log.auxiliary_sets as { exercise?: string; rpe_actual?: number }[])
        : []
      const auxByExercise = new Map<string, number>()
      for (const s of auxSets) {
        if (s.exercise) {
          auxByExercise.set(s.exercise, (auxByExercise.get(s.exercise) ?? 0) + rpeSetMultiplier(s.rpe_actual))
        }
      }
      for (const [exercise, effective] of auxByExercise) {
        const auxMuscles = getMusclesForExercise(exercise)
        const muscles = auxMuscles.length > 0 ? auxMuscles : getMusclesForLift(logLift)
        for (const { muscle, contribution } of muscles) {
          weeklyVolumeToDate[muscle] =
            (weeklyVolumeToDate[muscle] ?? 0) + Math.floor(effective * contribution)
        }
      }
    }

    // Compute week progress for pro-rated MEV in volume top-up
    if (weekInfo.programMode === 'unending') {
      totalSessionsThisWeek = weekInfo.trainingDaysPerWeek
      sessionIndex = (weekInfo.unendingSessionCounter % weekInfo.trainingDaysPerWeek) + 1
    } else {
      totalSessionsThisWeek = weekCounts.total
      sessionIndex = weekCounts.completed + 1
    }
  }

  const disruptionRows = await fetchActiveDisruptions(userId)
  const activeDisruptions = disruptionRows.map((row) => DisruptionSchema.parse(row))

  // Merge all three lift pools for widest top-up selection (engine-027)
  const auxiliaryPool = allPools
    ? [...allPools.squat, ...allPools.bench, ...allPools.deadlift]
    : []

  const jitInput: JITInput = {
    sessionId: session.id,
    weekNumber: session.week_number,
    blockNumber,
    primaryLift: lift,
    intensityType,
    oneRmKg: resolvedOneRmKg,
    formulaConfig,
    sorenessRatings,
    weeklyVolumeToDate,
    mrvMevConfig,
    activeAuxiliaries,
    recentLogs,
    activeDisruptions,
    warmupConfig,
    userRestOverrides,
    biologicalSex: biologicalSex ?? undefined,
    barWeightKg,
    daysSinceLastSession: daysSinceLastSession ?? undefined,
    userAge,
    auxiliaryPool,
    sleepQuality,
    energyLevel,
    cyclePhase,
    sessionIndex,
    totalSessionsThisWeek,
  }

  const strategyOverride = await getJITStrategyOverride()

  const comparisonLogger = (
    input: JITInput,
    formulaOutput: JITOutput,
    llmOutput: JITOutput,
    divergence: unknown,
  ) => {
    void typedSupabase.from('jit_comparison_logs').insert([{
      user_id: userId,
      session_id: session.id,
      jit_input: toJson(input),
      formula_output: toJson(formulaOutput),
      llm_output: toJson(llmOutput),
      divergence: toJson(divergence),
      strategy_used: 'llm',
    }]).then(({ error }) => {
      if (error) captureException(error)
    })
  }

  const generator = getJITGenerator(strategyOverride, true, comparisonLogger)
  const jitOutput = await generator.generate(jitInput)

  await typedSupabase
    .from('sessions')
    .update({
      planned_sets: jitOutput.mainLiftSets,
      jit_generated_at: jitOutput.generatedAt.toISOString(),
      jit_strategy: jitOutput.jit_strategy ?? generator.name,
      jit_input_snapshot: {
        sessionId: session.id,
        lift,
        blockNumber,
        intensityType,
      },
    })
    .eq('id', session.id)

  return jitOutput
}
