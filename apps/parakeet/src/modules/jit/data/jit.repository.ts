import type { Lift } from '@parakeet/shared-types';
import { typedSupabase } from '@platform/supabase';

export interface JitProfileRow {
  bodyweight_kg: number | string | null | undefined;
  date_of_birth: string | null | undefined;
}

export async function fetchJitProfile(
  userId: string
): Promise<JitProfileRow | null> {
  const { data, error } = await typedSupabase
    .from('profiles')
    .select('bodyweight_kg, date_of_birth')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as JitProfileRow | null;
}

export interface JitRecentSessionLogRow {
  session_rpe: number | null;
  actual_sets: unknown;
  planned_sets: unknown;
}

export async function fetchRecentSessionLogsForLift(
  userId: string,
  lift: Lift,
  limit: number
): Promise<JitRecentSessionLogRow[]> {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select('session_rpe, actual_sets, sessions!inner(primary_lift, planned_sets)')
    .eq('user_id', userId)
    .eq('sessions.primary_lift', lift)
    .gte('completed_at', sixtyDaysAgo)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((r) => {
    const session = Array.isArray(r.sessions) ? r.sessions[0] : r.sessions;
    return {
      session_rpe: r.session_rpe ?? null,
      actual_sets: r.actual_sets,
      planned_sets: session?.planned_sets ?? null,
    };
  });
}

export interface JitWeeklyLogRow {
  actual_sets: unknown;
  auxiliary_sets: unknown;
  sessions:
    | { primary_lift: string; week_number: number; program_id: string }
    | { primary_lift: string; week_number: number; program_id: string }[]
    | null;
}

export async function fetchWeeklySessionLogs(
  userId: string,
  programId: string,
  weekNumber: number
): Promise<JitWeeklyLogRow[]> {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select(
      'actual_sets, auxiliary_sets, sessions!inner(primary_lift, week_number, program_id)'
    )
    .eq('user_id', userId)
    .eq('sessions.program_id', programId)
    .eq('sessions.week_number', weekNumber);

  if (error) throw error;
  return (data ?? []) as JitWeeklyLogRow[];
}

export async function fetchWeekSessionCounts(
  programId: string,
  weekNumber: number
): Promise<{ total: number; completed: number }> {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('id, status')
    .eq('program_id', programId)
    .eq('week_number', weekNumber);

  if (error) throw error;
  const rows = data ?? [];
  return {
    total: rows.length,
    completed: rows.filter((r) => r.status === 'completed').length,
  };
}

export async function fetchProgramWeekInfo(programId: string): Promise<{
  programMode: string;
  trainingDaysPerWeek: number;
  unendingSessionCounter: number;
}> {
  const { data, error } = await typedSupabase
    .from('programs')
    .select('program_mode, training_days_per_week, unending_session_counter')
    .eq('id', programId)
    .single();

  if (error) throw error;
  return {
    programMode: data.program_mode ?? 'scheduled',
    trainingDaysPerWeek: data.training_days_per_week ?? 3,
    unendingSessionCounter: data.unending_session_counter ?? 0,
  };
}

export interface JitDisruptionRow {
  id: string;
  user_id: string;
  program_id: string | null;
  session_ids_affected: string[] | null;
  reported_at: string;
  disruption_type: string;
  severity: string;
  affected_date_start: string | null;
  affected_date_end: string | null;
  affected_lifts: string[] | null;
  description: string | null;
  adjustment_applied: unknown;
  resolved_at: string | null;
  status: string;
}

export interface ChallengeReviewRow {
  score: number;
  verdict: 'accept' | 'flag';
  concerns: string[];
  suggested_overrides: Record<string, unknown> | null;
}

export async function fetchChallengeReview(
  sessionId: string
): Promise<ChallengeReviewRow | null> {
  const { data } = await typedSupabase
    .from('challenge_reviews')
    .select('score, verdict, concerns, suggested_overrides')
    .eq('session_id', sessionId)
    .limit(1)
    .single();
  if (!data) return null;
  return {
    score: data.score,
    verdict: data.verdict as 'accept' | 'flag',
    concerns: Array.isArray(data.concerns) ? (data.concerns as string[]) : [],
    suggested_overrides: data.suggested_overrides as Record<string, unknown> | null,
  };
}

export async function fetchUpcomingSessionLifts(
  programId: string,
  weekNumber: number,
  currentDayNumber: number
): Promise<string[]> {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('primary_lift')
    .eq('program_id', programId)
    .eq('week_number', weekNumber)
    .gt('day_number', currentDayNumber)
    .neq('status', 'completed')
    .not('primary_lift', 'is', null);

  if (error) throw error;
  return (data ?? []).map((r) => r.primary_lift!).filter(Boolean);
}

export async function fetchActiveDisruptions(
  userId: string
): Promise<JitDisruptionRow[]> {
  const { data, error } = await typedSupabase
    .from('disruptions')
    .select(
      'id, user_id, program_id, session_ids_affected, reported_at, disruption_type, severity, affected_date_start, affected_date_end, affected_lifts, description, adjustment_applied, resolved_at, status'
    )
    .eq('user_id', userId)
    .neq('status', 'resolved')
    .or(`affected_date_end.is.null,affected_date_end.gte.${new Date().toISOString().slice(0, 10)}`);

  if (error) throw error;
  return (data ?? []) as JitDisruptionRow[];
}
