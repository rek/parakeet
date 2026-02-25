import {
  suggestProgramAdjustments,
  DEFAULT_THRESHOLDS,
} from '@parakeet/training-engine'
import type { SessionLogSummary, CompletedSetLog } from '@parakeet/training-engine'
import type { Lift } from '@parakeet/shared-types'
import { supabase } from './supabase'

export interface CompleteSessionInput {
  actualSets: {
    set_number: number
    weight_grams: number
    reps_completed: number
    rpe_actual?: number
    notes?: string
  }[]
  sessionRpe?: number
  startedAt?: Date
  completedAt?: Date
}

// Today's session: nearest upcoming session not yet completed/skipped
export async function findTodaySession(userId: string) {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['planned', 'in_progress'])
    .gte('planned_date', today)
    .order('planned_date', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data
}

// Full session detail
export async function getSession(sessionId: string) {
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle()
  return data
}

// All sessions for a given week of a program
export async function getSessionsForWeek(programId: string, weekNumber: number) {
  const { data } = await supabase
    .from('sessions')
    .select(
      'id, week_number, day_number, primary_lift, intensity_type, block_number, is_deload, planned_date, status, jit_generated_at',
    )
    .eq('program_id', programId)
    .eq('week_number', weekNumber)
    .order('planned_date', { ascending: true })
  return data ?? []
}

// Paginated list of completed sessions (History tab)
export async function getCompletedSessions(
  userId: string,
  page: number,
  pageSize = 20,
) {
  const { data } = await supabase
    .from('sessions')
    .select(
      'id, primary_lift, intensity_type, planned_date, status, week_number, block_number',
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('planned_date', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)
  return data ?? []
}

// Transition session to in_progress
export async function startSession(sessionId: string): Promise<void> {
  await supabase
    .from('sessions')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('status', 'planned')
}

// Skip a session (planned or in_progress → skipped)
export async function skipSession(sessionId: string, reason?: string): Promise<void> {
  await supabase
    .from('sessions')
    .update({ status: 'skipped', notes: reason ?? null })
    .eq('id', sessionId)
    .in('status', ['planned', 'in_progress'])
}

// Complete a session: log sets, update status, run performance adjuster
export async function completeSession(
  sessionId: string,
  userId: string,
  input: CompleteSessionInput,
): Promise<void> {
  const { actualSets, sessionRpe, startedAt, completedAt } = input

  const session = await getSession(sessionId)
  const plannedCount = (session?.planned_sets as unknown[] | null)?.length ?? actualSets.length
  const completionPct =
    (actualSets.filter((s) => s.reps_completed > 0).length / plannedCount) * 100
  const performanceVsPlan = classifyPerformance(actualSets, completionPct)

  await supabase.from('session_logs').insert({
    session_id:          sessionId,
    user_id:             userId,
    actual_sets:         actualSets,
    session_rpe:         sessionRpe ?? null,
    completion_pct:      completionPct,
    performance_vs_plan: performanceVsPlan,
    started_at:          startedAt?.toISOString() ?? null,
    completed_at:        (completedAt ?? new Date()).toISOString(),
  })

  await supabase
    .from('sessions')
    .update({ status: 'completed' })
    .eq('id', sessionId)

  if (session?.primary_lift) {
    const recentLogs = await getRecentLogsForLift(
      userId,
      session.primary_lift as Lift,
      6,
    )
    const suggestions = suggestProgramAdjustments(recentLogs, DEFAULT_THRESHOLDS)

    if (suggestions.length > 0) {
      await supabase.from('performance_metrics').insert({
        session_id:  sessionId,
        user_id:     userId,
        suggestions,
        computed_at: new Date().toISOString(),
      })
    }
  }

  // Check if program has reached ≥80% completion → trigger async cycle review
  if (session?.program_id) {
    const { data: allSessions } = await supabase
      .from('sessions')
      .select('status')
      .eq('program_id', session.program_id)
      .eq('user_id', userId)

    const total = allSessions?.length ?? 0
    const completed = allSessions?.filter((s: { status: string }) => s.status === 'completed').length ?? 0
    if (total > 0 && completed / total >= 0.8) {
      const { onCycleComplete } = await import('./programs')
      onCycleComplete(session.program_id, userId)
    }
  }
}

// Session logs for the current calendar week (Sun–Sat)
export async function getCurrentWeekLogs(userId: string): Promise<CompletedSetLog[]> {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 7)

  const { data } = await supabase
    .from('session_logs')
    .select('actual_sets, sessions!inner(primary_lift)')
    .eq('user_id', userId)
    .gte('completed_at', startOfWeek.toISOString())
    .lt('completed_at', endOfWeek.toISOString())

  return (data ?? []).map((row) => {
    const sessRaw = row.sessions as unknown
    const sess = (Array.isArray(sessRaw) ? sessRaw[0] : sessRaw) as { primary_lift: string } | null
    const sets = Array.isArray(row.actual_sets)
      ? (row.actual_sets as { reps_completed?: number }[])
      : []
    const completedSets = sets.filter((s) => (s.reps_completed ?? 0) > 0).length
    return {
      lift: (sess?.primary_lift ?? 'squat') as Lift,
      completedSets: completedSets || sets.length,
    }
  })
}

// --- Private helpers ---

type PerformanceVsPlan = 'over' | 'at' | 'under' | 'incomplete'

function classifyPerformance(
  actualSets: CompleteSessionInput['actualSets'],
  completionPct: number,
): PerformanceVsPlan {
  if (completionPct < 50) return 'incomplete'
  if (completionPct < 90) return 'under'
  const avgRepsCompleted =
    actualSets.reduce((sum, s) => sum + s.reps_completed, 0) / actualSets.length
  // "over" means avg actual > planned by >10% — without knowing planned reps per set,
  // we use completion_pct > 110 as a proxy (set count exceeded plan)
  if (completionPct > 110) return 'over'
  return 'at'
}

async function getRecentLogsForLift(
  userId: string,
  lift: Lift,
  limit: number,
): Promise<SessionLogSummary[]> {
  const { data } = await supabase
    .from('session_logs')
    .select(
      'id, completion_pct, session_rpe, sessions!inner(primary_lift, intensity_type)',
    )
    .eq('user_id', userId)
    .eq('sessions.primary_lift', lift)
    .order('completed_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map((row) => {
    const sessRaw = row.sessions as unknown
    const sess = (Array.isArray(sessRaw) ? sessRaw[0] : sessRaw) as { primary_lift: string; intensity_type: string } | null
    return {
      session_id:      row.id,
      lift:            (sess?.primary_lift ?? lift) as Lift,
      intensity_type:  (sess?.intensity_type ?? 'heavy') as SessionLogSummary['intensity_type'],
      actual_rpe:      row.session_rpe ?? null,
      target_rpe:      8.5,
      completion_pct:  row.completion_pct ?? null,
    }
  })
}
