import {
  getJITGenerator,
  getMusclesForLift,
  getMusclesForExercise,
  DEFAULT_AUXILIARY_POOLS,
} from '@parakeet/training-engine'
import type {
  JITInput,
  JITOutput,
  SorenessLevel,
  MuscleGroup,
  RecentSessionSummary,
} from '@parakeet/training-engine'
import { LiftSchema, IntensityTypeSchema, BlockNumberSchema, DisruptionSchema } from '@parakeet/shared-types'
import { getFormulaConfig } from '@modules/formula'
import { getSession } from '@modules/session'
import {
  getCurrentOneRmKg,
  getActiveAssignments,
} from '@modules/program'
import { getMrvMevConfig } from '@modules/training-volume'
import { getJITStrategyOverride, getUserRestOverrides, getWarmupConfig } from '@modules/settings'
import type { Json } from '@platform/supabase'
import { typedSupabase } from '@platform/supabase'
import { fetchProfileSex } from '../../session/data/session.repository'
import { estimateOneRmKgFromProfile } from './max-estimation'

type Session = Awaited<ReturnType<typeof getSession>>

export async function runJITForSession(
  session: NonNullable<Session>,
  userId: string,
  sorenessRatings: Partial<Record<MuscleGroup, SorenessLevel>>,
): Promise<JITOutput> {
  const lift = LiftSchema.parse(session.primary_lift)
  const intensityType = IntensityTypeSchema.parse(session.intensity_type)
  const blockNumber = BlockNumberSchema.parse(session.block_number)

  const biologicalSex = await fetchProfileSex(userId)

  const [oneRmKg, formulaConfig, assignments, warmupConfig, userRestOverrides] =
    await Promise.all([
      getCurrentOneRmKg(userId, lift),
      getFormulaConfig(userId),
      getActiveAssignments(userId, session.program_id, blockNumber),
      getWarmupConfig(userId, lift, biologicalSex),
      getUserRestOverrides(userId),
    ])

  const mrvMevConfig = await getMrvMevConfig(userId, biologicalSex)

  let resolvedOneRmKg = oneRmKg
  if (resolvedOneRmKg === null) {
    const { data: profile } = await typedSupabase
      .from('profiles')
      .select('bodyweight_kg, date_of_birth')
      .eq('id', userId)
      .maybeSingle()

    const rawBodyweight = (profile as { bodyweight_kg?: number | string | null } | null)?.bodyweight_kg
    const bodyweightKg =
      typeof rawBodyweight === 'number'
        ? rawBodyweight
        : typeof rawBodyweight === 'string'
          ? parseFloat(rawBodyweight)
          : null

    const dateOfBirth = (profile as { date_of_birth?: string | null } | null)?.date_of_birth ?? null

    resolvedOneRmKg = estimateOneRmKgFromProfile({
      lift,
      biologicalSex: biologicalSex ?? null,
      dateOfBirth,
      bodyweightKg,
    })
  }

  const activeAuxiliaries: [string, string] =
    assignments[lift]
    ?? [DEFAULT_AUXILIARY_POOLS[lift][0], DEFAULT_AUXILIARY_POOLS[lift][1]] as [string, string]

  const { data: recentData } = await typedSupabase
    .from('session_logs')
    .select('session_rpe, sessions!inner(primary_lift)')
    .eq('user_id', userId)
    .eq('sessions.primary_lift', lift)
    .order('completed_at', { ascending: false })
    .limit(6)

  const recentLogs: RecentSessionSummary[] = (recentData ?? []).map((r) => ({
    actual_rpe: r.session_rpe ?? null,
    target_rpe: 8.5,
  }))

  const { data: weekLogs } = await typedSupabase
    .from('session_logs')
    .select('actual_sets, auxiliary_sets, sessions!inner(primary_lift, week_number, program_id)')
    .eq('user_id', userId)
    .eq('sessions.program_id', session.program_id)
    .eq('sessions.week_number', session.week_number)

  const weeklyVolumeToDate: Partial<Record<MuscleGroup, number>> = {}
  for (const log of weekLogs ?? []) {
    const joinedSession = Array.isArray(log.sessions) ? log.sessions[0] : log.sessions
    const rawLift = joinedSession?.primary_lift
    const logLift = LiftSchema.safeParse(rawLift).data
    if (!logLift) continue

    // Main lift sets
    const setCount = Array.isArray(log.actual_sets)
      ? (log.actual_sets as unknown[]).length
      : 0
    const mainMuscles = getMusclesForLift(logLift)
    for (const { muscle, contribution } of mainMuscles) {
      weeklyVolumeToDate[muscle] =
        (weeklyVolumeToDate[muscle] ?? 0) + Math.round(setCount * contribution)
    }

    // Aux sets grouped by exercise name for per-exercise muscle mapping
    const auxSets = Array.isArray(log.auxiliary_sets)
      ? (log.auxiliary_sets as { exercise?: string }[])
      : []
    const auxByExercise = new Map<string, number>()
    for (const s of auxSets) {
      if (s.exercise) auxByExercise.set(s.exercise, (auxByExercise.get(s.exercise) ?? 0) + 1)
    }
    for (const [exercise, count] of auxByExercise) {
      const auxMuscles = getMusclesForExercise(exercise)
      const muscles = auxMuscles.length > 0 ? auxMuscles : getMusclesForLift(logLift)
      for (const { muscle, contribution } of muscles) {
        weeklyVolumeToDate[muscle] =
          (weeklyVolumeToDate[muscle] ?? 0) + Math.round(count * contribution)
      }
    }
  }

  const { data: disruptionRows } = await typedSupabase
    .from('disruptions')
    .select('id, user_id, program_id, session_ids_affected, reported_at, disruption_type, severity, affected_date_start, affected_date_end, affected_lifts, description, adjustment_applied, resolved_at, status')
    .eq('user_id', userId)
    .neq('status', 'resolved')

  const activeDisruptions = (disruptionRows ?? []).map((row) => DisruptionSchema.parse(row))

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
      jit_input: input as unknown as Json,
      formula_output: formulaOutput as unknown as Json,
      llm_output: llmOutput as unknown as Json,
      divergence: divergence as unknown as Json,
      strategy_used: 'llm',
    }])
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
