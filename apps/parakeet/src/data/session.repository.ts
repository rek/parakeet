import type { Lift } from '@parakeet/shared-types';

import { typedSupabase } from '../network/supabase-client';
import { DbInsert, Json } from '../network/database';

export async function fetchTodaySession(userId: string, today: string) {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['planned', 'in_progress', 'completed'])
    .eq('planned_date', today)
    .order('planned_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchSessionById(sessionId: string) {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchSessionCompletionContext(sessionId: string) {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('primary_lift, program_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchSessionsForWeek(programId: string, weekNumber: number) {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select(
      'id, week_number, day_number, primary_lift, intensity_type, block_number, is_deload, planned_date, status, jit_generated_at',
    )
    .eq('program_id', programId)
    .eq('week_number', weekNumber)
    .order('planned_date', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchCompletedSessions(
  userId: string,
  page: number,
  pageSize: number,
) {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select(
      'id, primary_lift, intensity_type, planned_date, status, week_number, block_number, session_logs(cycle_phase, session_rpe)',
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('planned_date', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) throw error;
  return (data ?? []).map((row) => {
    const logs = Array.isArray(row.session_logs) ? row.session_logs : []
    type LogRow = { cycle_phase?: string | null; session_rpe?: number | null }
    const log = (logs[0] as LogRow | undefined)
    return {
      id:             row.id,
      primary_lift:   row.primary_lift,
      intensity_type: row.intensity_type,
      planned_date:   row.planned_date,
      status:         row.status,
      week_number:    row.week_number,
      block_number:   row.block_number,
      cycle_phase:    log?.cycle_phase ?? null,
      rpe:            log?.session_rpe ?? null,
    }
  })
}

export async function fetchProgramSessionStatuses(programId: string, userId: string) {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('status')
    .eq('program_id', programId)
    .eq('user_id', userId);

  if (error) throw error;
  return data ?? [];
}

export async function insertSorenessCheckin(input: {
  sessionId: string;
  userId: string;
  ratings: Record<string, number>;
  skipped: boolean;
}): Promise<void> {
  const { error } = await typedSupabase.from('soreness_checkins').insert({
    session_id: input.sessionId,
    user_id: input.userId,
    ratings: input.ratings,
    skipped: input.skipped,
    recorded_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function updateSessionToInProgress(sessionId: string): Promise<void> {
  const { error } = await typedSupabase
    .from('sessions')
    .update({ status: 'in_progress' })
    .eq('id', sessionId)
    .eq('status', 'planned');
  if (error) throw error;
}

export async function updateSessionToSkipped(sessionId: string, _reason?: string): Promise<void> {
  const { error } = await typedSupabase
    .from('sessions')
    .update({ status: 'skipped' })
    .eq('id', sessionId)
    .in('status', ['planned', 'in_progress']);
  if (error) throw error;
}

export async function insertSessionLog(input: {
  sessionId: string;
  userId: string;
  actualSets: Json[];
  auxiliarySets?: Json[];
  sessionRpe: number | undefined;
  completionPct: number;
  performanceVsPlan: 'over' | 'at' | 'under' | 'incomplete';
  startedAt?: Date;
  completedAt?: Date;
}): Promise<string> {
  const { data, error } = await typedSupabase.from('session_logs').insert({
    session_id: input.sessionId,
    user_id: input.userId,
    actual_sets: input.actualSets,
    auxiliary_sets: input.auxiliarySets ?? null,
    session_rpe: input.sessionRpe ?? null,
    completion_pct: input.completionPct,
    performance_vs_plan: input.performanceVsPlan,
    started_at: input.startedAt?.toISOString() ?? null,
    completed_at: (input.completedAt ?? new Date()).toISOString(),
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function updateSessionToCompleted(sessionId: string): Promise<void> {
  const { error } = await typedSupabase
    .from('sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function fetchProfileSex(userId: string): Promise<'female' | 'male' | undefined> {
  const { data, error } = await typedSupabase
    .from('profiles')
    .select('biological_sex')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  const sex = data?.biological_sex;
  return sex === 'female' || sex === 'male' ? sex : undefined;
}

export type PerformanceMetricsInsert = DbInsert<'performance_metrics'>;

export async function insertPerformanceMetric(input: PerformanceMetricsInsert): Promise<void> {
  const { error } = await typedSupabase.from('performance_metrics').insert(input);
  if (error) throw error;
}

export async function fetchRecentLogsForLift(
  userId: string,
  lift: Lift,
  limit: number,
) {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select('id, completion_pct, session_rpe, sessions!inner(primary_lift, intensity_type)')
    .eq('user_id', userId)
    .eq('sessions.primary_lift', lift)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function fetchCurrentWeekLogs(userId: string, startIso: string, endIso: string) {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select('actual_sets, sessions!inner(primary_lift)')
    .eq('user_id', userId)
    .gte('completed_at', startIso)
    .lt('completed_at', endIso);

  if (error) throw error;
  return data ?? [];
}

export async function fetchOverdueScheduledSessions(userId: string, today: string) {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('id, planned_date, primary_lift, week_number, program_id')
    .eq('user_id', userId)
    .eq('status', 'planned')
    .lt('planned_date', today);

  if (error) throw error;
  return data ?? [];
}

export async function fetchProgramSessionsForMakeup(programId: string, userId: string) {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('id, planned_date, primary_lift, week_number')
    .eq('program_id', programId)
    .eq('user_id', userId);

  if (error) throw error;
  return data ?? [];
}

export async function markSessionAsMissed(sessionId: string): Promise<void> {
  const { error } = await typedSupabase
    .from('sessions')
    .update({ status: 'missed' })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function fetchLastCompletedAtForLift(
  userId: string,
  lift: Lift,
) {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select('completed_at, sessions!inner(primary_lift)')
    .eq('user_id', userId)
    .eq('sessions.primary_lift', lift)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
