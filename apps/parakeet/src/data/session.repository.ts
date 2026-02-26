import type { Lift } from '@parakeet/shared-types';

import { typedSupabase } from '../network/supabase-client';

const db = typedSupabase as any;

export async function fetchTodaySession(userId: string, today: string) {
  const { data } = await db
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['planned', 'in_progress'])
    .gte('planned_date', today)
    .order('planned_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function fetchSessionById(sessionId: string) {
  const { data } = await db
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  return data;
}

export async function fetchSessionCompletionContext(sessionId: string) {
  const { data } = await db
    .from('sessions')
    .select('primary_lift, program_id')
    .eq('id', sessionId)
    .maybeSingle();

  return data;
}

export async function fetchSessionsForWeek(programId: string, weekNumber: number) {
  const { data } = await db
    .from('sessions')
    .select(
      'id, week_number, day_number, primary_lift, intensity_type, block_number, is_deload, planned_date, status, jit_generated_at',
    )
    .eq('program_id', programId)
    .eq('week_number', weekNumber)
    .order('planned_date', { ascending: true });

  return data ?? [];
}

export async function fetchCompletedSessions(
  userId: string,
  page: number,
  pageSize: number,
) {
  const { data } = await db
    .from('sessions')
    .select(
      'id, primary_lift, intensity_type, planned_date, status, week_number, block_number',
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('planned_date', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  return data ?? [];
}

export async function fetchProgramSessionStatuses(programId: string, userId: string) {
  const { data } = await db
    .from('sessions')
    .select('status')
    .eq('program_id', programId)
    .eq('user_id', userId);

  return data ?? [];
}

export async function insertSorenessCheckin(input: {
  sessionId: string;
  userId: string;
  ratings: Record<string, number>;
  skipped: boolean;
}): Promise<void> {
  await db.from('soreness_checkins').insert({
    session_id: input.sessionId,
    user_id: input.userId,
    ratings: input.ratings,
    skipped: input.skipped,
    recorded_at: new Date().toISOString(),
  });
}

export async function updateSessionToInProgress(sessionId: string): Promise<void> {
  await db
    .from('sessions')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('status', 'planned');
}

export async function updateSessionToSkipped(sessionId: string, reason?: string): Promise<void> {
  await db
    .from('sessions')
    .update({ status: 'skipped', notes: reason ?? null })
    .eq('id', sessionId)
    .in('status', ['planned', 'in_progress']);
}

export async function insertSessionLog(input: {
  sessionId: string;
  userId: string;
  actualSets: unknown[];
  sessionRpe: number | undefined;
  completionPct: number;
  performanceVsPlan: 'over' | 'at' | 'under' | 'incomplete';
  startedAt?: Date;
  completedAt?: Date;
}): Promise<void> {
  await db.from('session_logs').insert({
    session_id: input.sessionId,
    user_id: input.userId,
    actual_sets: input.actualSets,
    session_rpe: input.sessionRpe ?? null,
    completion_pct: input.completionPct,
    performance_vs_plan: input.performanceVsPlan,
    started_at: input.startedAt?.toISOString() ?? null,
    completed_at: (input.completedAt ?? new Date()).toISOString(),
  });
}

export async function updateSessionToCompleted(sessionId: string): Promise<void> {
  await db
    .from('sessions')
    .update({ status: 'completed' })
    .eq('id', sessionId);
}

export async function fetchProfileSex(userId: string): Promise<'female' | 'male' | undefined> {
  const { data } = await db
    .from('profiles')
    .select('biological_sex')
    .eq('id', userId)
    .maybeSingle();

  const sex = data?.biological_sex;
  return sex === 'female' || sex === 'male' ? sex : undefined;
}

export async function insertPerformanceMetric(input: {
  sessionId: string;
  userId: string;
  suggestions: unknown;
}): Promise<void> {
  await db.from('performance_metrics').insert({
    session_id: input.sessionId,
    user_id: input.userId,
    suggestions: input.suggestions,
    computed_at: new Date().toISOString(),
  });
}

export async function fetchRecentLogsForLift(
  userId: string,
  lift: Lift,
  limit: number,
) {
  const { data } = await db
    .from('session_logs')
    .select('id, completion_pct, session_rpe, sessions!inner(primary_lift, intensity_type)')
    .eq('user_id', userId)
    .eq('sessions.primary_lift', lift)
    .order('completed_at', { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function fetchCurrentWeekLogs(userId: string, startIso: string, endIso: string) {
  const { data } = await db
    .from('session_logs')
    .select('actual_sets, sessions!inner(primary_lift)')
    .eq('user_id', userId)
    .gte('completed_at', startIso)
    .lt('completed_at', endIso);

  return data ?? [];
}

export async function fetchOverdueScheduledSessions(userId: string, today: string) {
  const { data } = await db
    .from('sessions')
    .select('id, scheduled_date, primary_lift, week_number, program_id')
    .eq('user_id', userId)
    .eq('status', 'scheduled')
    .lt('scheduled_date', today);

  return data ?? [];
}

export async function fetchProgramSessionsForMakeup(programId: string, userId: string) {
  const { data } = await db
    .from('sessions')
    .select('id, scheduled_date, primary_lift, week_number')
    .eq('program_id', programId)
    .eq('user_id', userId);

  return data ?? [];
}

export async function markSessionAsMissed(sessionId: string, missedAtIso: string): Promise<void> {
  await db
    .from('sessions')
    .update({ status: 'missed', missed_at: missedAtIso })
    .eq('id', sessionId);
}

export async function fetchLastCompletedAtForLift(
  userId: string,
  lift: Lift,
) {
  const { data } = await db
    .from('session_logs')
    .select('completed_at, sessions!inner(primary_lift)')
    .eq('user_id', userId)
    .eq('sessions.primary_lift', lift)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}
