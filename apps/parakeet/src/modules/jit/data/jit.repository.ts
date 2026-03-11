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
}

export async function fetchRecentSessionLogsForLift(
  userId: string,
  lift: Lift,
  limit: number
): Promise<JitRecentSessionLogRow[]> {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select('session_rpe, sessions!inner(primary_lift)')
    .eq('user_id', userId)
    .eq('sessions.primary_lift', lift)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((r) => ({ session_rpe: r.session_rpe ?? null }));
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
  session_ids_affected: unknown;
  reported_at: string;
  disruption_type: string;
  severity: string;
  affected_date_start: string | null;
  affected_date_end: string | null;
  affected_lifts: unknown;
  description: string | null;
  adjustment_applied: unknown;
  resolved_at: string | null;
  status: string;
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
    .neq('status', 'resolved');

  if (error) throw error;
  return (data ?? []) as JitDisruptionRow[];
}
