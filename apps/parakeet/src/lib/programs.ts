import {
  generateProgram,
  generateAuxiliaryAssignments,
  computeBlockOffset,
} from '@parakeet/training-engine'
import { supabase } from './supabase'
import { getAuxiliaryPools } from './auxiliary-config'
import { getCurrentMaxes } from './lifter-maxes'
import { getFormulaConfig } from './formulas'

export interface CreateProgramInput {
  totalWeeks: 10 | 12 | 14
  trainingDaysPerWeek: 3 | 4
  startDate: Date
}

export type RegenerateProgramInput = CreateProgramInput

async function getBlockOffset(userId: string): Promise<number> {
  const { data } = await supabase
    .from('programs')
    .select('total_weeks, status')
    .eq('user_id', userId)
    .eq('status', 'archived')
  const history = (data ?? []).map((p) => ({ completedBlocks: Math.floor(p.total_weeks / 4) }))
  return computeBlockOffset(history)
}

export async function createProgram(input: CreateProgramInput) {
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const maxes = await getCurrentMaxes(userId)
  const formulaConfig = await getFormulaConfig(userId)

  const scaffold = generateProgram({
    totalWeeks: input.totalWeeks,
    trainingDaysPerWeek: input.trainingDaysPerWeek,
    startDate: input.startDate,
  })

  const auxiliaryPool = await getAuxiliaryPools(userId)
  const blockOffset = await getBlockOffset(userId)

  // Archive current active program
  await supabase
    .from('programs')
    .update({ status: 'archived' })
    .eq('user_id', userId)
    .eq('status', 'active')

  const { data: maxVersionRow } = await supabase
    .from('programs')
    .select('version')
    .eq('user_id', userId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextVersion = ((maxVersionRow as { version?: number } | null)?.version ?? 0) + 1

  const { data: program } = await supabase
    .from('programs')
    .insert({
      user_id:                userId,
      status:                 'active',
      version:                nextVersion,
      total_weeks:            input.totalWeeks,
      training_days_per_week: input.trainingDaysPerWeek,
      start_date:             input.startDate.toISOString().split('T')[0],
      lifter_maxes_id:        maxes?.id ?? null,
      formula_config_id:      null, // resolved at JIT runtime
    })
    .select()
    .single()

  const auxiliaryAssignments = generateAuxiliaryAssignments(
    program!.id,
    input.totalWeeks,
    auxiliaryPool,
    blockOffset,
  )

  const sessionRows = scaffold.sessions.map((s) => ({
    user_id:        userId,
    program_id:     program!.id,
    week_number:    s.weekNumber,
    day_number:     s.dayNumber,
    primary_lift:   s.primaryLift,
    intensity_type: s.intensityType,
    block_number:   s.blockNumber,
    is_deload:      s.isDeload,
    planned_date:   s.plannedDate.toISOString().split('T')[0],
    status:         'planned',
    planned_sets:   null,
    jit_generated_at: null,
  }))

  await supabase.from('sessions').insert(sessionRows)
  await supabase.from('auxiliary_assignments').insert(
    auxiliaryAssignments.map((a) => ({ ...a, user_id: userId })),
  )

  return program
}

export async function regenerateProgram(input: RegenerateProgramInput) {
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const maxes = await getCurrentMaxes(userId)
  const scaffold = generateProgram({
    totalWeeks: input.totalWeeks,
    trainingDaysPerWeek: input.trainingDaysPerWeek,
    startDate: input.startDate,
  })

  const auxiliaryPool = await getAuxiliaryPools(userId)
  const blockOffset = await getBlockOffset(userId)

  await supabase
    .from('programs')
    .update({ status: 'archived' })
    .eq('user_id', userId)
    .eq('status', 'active')

  const { data: maxVersionRow } = await supabase
    .from('programs')
    .select('version')
    .eq('user_id', userId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextVersion = ((maxVersionRow as { version?: number } | null)?.version ?? 0) + 1

  const { data: program } = await supabase
    .from('programs')
    .insert({
      user_id:                userId,
      status:                 'active',
      version:                nextVersion,
      total_weeks:            input.totalWeeks,
      training_days_per_week: input.trainingDaysPerWeek,
      start_date:             input.startDate.toISOString().split('T')[0],
      lifter_maxes_id:        maxes?.id ?? null,
    })
    .select()
    .single()

  const auxiliaryAssignments = generateAuxiliaryAssignments(
    program!.id,
    input.totalWeeks,
    auxiliaryPool,
    blockOffset,
  )

  const sessionRows = scaffold.sessions.map((s) => ({
    user_id:          userId,
    program_id:       program!.id,
    week_number:      s.weekNumber,
    day_number:       s.dayNumber,
    primary_lift:     s.primaryLift,
    intensity_type:   s.intensityType,
    block_number:     s.blockNumber,
    is_deload:        s.isDeload,
    planned_date:     s.plannedDate.toISOString().split('T')[0],
    status:           'planned',
    planned_sets:     null,
    jit_generated_at: null,
  }))

  await supabase.from('sessions').insert(sessionRows)
  await supabase.from('auxiliary_assignments').insert(
    auxiliaryAssignments.map((a) => ({ ...a, user_id: userId })),
  )

  return program
}

export async function getActiveProgram(userId: string) {
  const { data } = await supabase
    .from('programs')
    .select(`
      *,
      sessions(id, week_number, day_number, primary_lift, intensity_type,
               block_number, is_deload, planned_date, status, jit_generated_at)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  return data
}

export async function getProgram(programId: string) {
  const { data } = await supabase
    .from('programs')
    .select('*, sessions(*)')
    .eq('id', programId)
    .maybeSingle()
  return data
}

export async function listPrograms(userId: string) {
  const { data } = await supabase
    .from('programs')
    .select('id, status, total_weeks, training_days_per_week, start_date, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function updateProgramStatus(
  programId: string,
  status: 'completed' | 'archived',
): Promise<void> {
  await supabase
    .from('programs')
    .update({ status })
    .eq('id', programId)
    .eq('status', 'active')
}

// Triggered after each session completion when program reaches ≥80% done.
// Fire-and-forget: errors are logged but do not block the caller.
export function onCycleComplete(programId: string, userId: string): void {
  import('./cycle-review')
    .then(({ compileCycleReport, getPreviousCycleSummaries, storeCycleReview }) =>
      import('@parakeet/training-engine')
        .then(({ generateCycleReview }) =>
          compileCycleReport(programId, userId)
            .then((report) =>
              getPreviousCycleSummaries(userId, 3).then((summaries) =>
                generateCycleReview(report, summaries).then((review) =>
                  storeCycleReview(programId, userId, report, review),
                ),
              ),
            ),
        ),
    )
    .catch((err) => console.error('[onCycleComplete] cycle review failed:', err))
}
