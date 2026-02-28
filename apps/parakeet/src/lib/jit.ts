import {
  getJITGenerator,
  getMusclesForLift,
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
import { supabase } from './supabase'
import { getCurrentOneRmKg } from './lifter-maxes'
import { getFormulaConfig } from './formulas'
import { getMrvMevConfig } from './volume-config'
import { getActiveAssignments } from './auxiliary-config'
import { getWarmupConfig } from './warmup-config'
import { getUserRestOverrides } from './rest-config'
import { estimateOneRmKgFromProfile } from './max-estimation'
import { fetchProfileSex } from '../data/session.repository'
import { getSession } from './sessions'

type Session = Awaited<ReturnType<typeof getSession>>

export async function runJITForSession(
  session: NonNullable<Session>,
  userId: string,
  sorenessRatings: Partial<Record<MuscleGroup, SorenessLevel>>,
): Promise<JITOutput> {
  const lift = LiftSchema.parse(session.primary_lift)
  const intensityType = IntensityTypeSchema.parse(session.intensity_type)
  const blockNumber = BlockNumberSchema.parse(session.block_number)

  // Fetch all config in parallel
  const [oneRmKg, formulaConfig, biologicalSex, assignments, warmupConfig, userRestOverrides] =
    await Promise.all([
      getCurrentOneRmKg(userId, lift),
      getFormulaConfig(userId),
      fetchProfileSex(userId),
      getActiveAssignments(userId, session.program_id, blockNumber),
      getWarmupConfig(userId, lift),
      getUserRestOverrides(userId),
    ])

  const mrvMevConfig = await getMrvMevConfig(userId, biologicalSex)

  let resolvedOneRmKg = oneRmKg
  if (resolvedOneRmKg === null) {
    const { data: profile } = await supabase
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

  // Resolve auxiliary pair — fall back to first two from default pool
  const activeAuxiliaries: [string, string] =
    assignments[lift] ??
    [DEFAULT_AUXILIARY_POOLS[lift][0], DEFAULT_AUXILIARY_POOLS[lift][1]] as [string, string]

  // Recent RPE history for this lift (last 6 sessions)
  const { data: recentData } = await supabase
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

  // Weekly volume already accumulated in this program week
  const { data: weekLogs } = await supabase
    .from('session_logs')
    .select('actual_sets, sessions!inner(primary_lift, week_number, program_id)')
    .eq('user_id', userId)
    .eq('sessions.program_id', session.program_id)
    .eq('sessions.week_number', session.week_number)

  const weeklyVolumeToDate: Partial<Record<MuscleGroup, number>> = {}
  for (const log of weekLogs ?? []) {
    const rawLift = log.sessions[0]?.primary_lift
    const logLift = LiftSchema.safeParse(rawLift).data
    if (!logLift) continue
    const muscles = getMusclesForLift(logLift)
    const setCount = Array.isArray(log.actual_sets)
      ? (log.actual_sets as unknown[]).length
      : 0
    for (const { muscle, contribution } of muscles) {
      weeklyVolumeToDate[muscle] =
        (weeklyVolumeToDate[muscle] ?? 0) + Math.round(setCount * contribution)
    }
  }

  // Active (unresolved) training disruptions
  const { data: disruptionRows } = await supabase
    .from('disruptions')
    .select('id, user_id, program_id, session_ids_affected, reported_at, disruption_type, severity, affected_date_start, affected_date_end, affected_lifts, description, resolved_at, status')
    .eq('user_id', userId)
    .neq('status', 'resolved')

  const activeDisruptions = (disruptionRows ?? []).map(row => DisruptionSchema.parse(row))

  // Build JIT input and generate
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

  const generator = getJITGenerator('auto', true)
  const jitOutput = await generator.generate(jitInput)

  // Persist the generated sets back to the session row
  await supabase
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
