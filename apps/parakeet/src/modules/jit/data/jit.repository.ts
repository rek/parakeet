// @spec docs/features/jit-pipeline/spec-generator.md
import { getSessionSetsBySessionIds } from '@modules/session';
import type { ActualSet, Lift } from '@parakeet/shared-types';
import type { Json } from '@platform/supabase';
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
  actual_sets: ActualSet[];
  planned_sets: unknown;
  /** True when this session was logged with any sets while a rehab cap was
   *  active for the lift (GH#220). Fed into `RecentSessionSummary` so the
   *  engine can exclude pollutes pain-ambiguous history. */
  containedRehabSets: boolean;
}

export async function fetchRecentSessionLogsForLift(
  userId: string,
  lift: Lift,
  limit: number
): Promise<JitRecentSessionLogRow[]> {
  const sixtyDaysAgo = new Date(
    Date.now() - 60 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select(
      'session_id, session_rpe, sessions!inner(primary_lift, planned_sets)'
    )
    .eq('user_id', userId)
    .eq('sessions.primary_lift', lift)
    .gte('completed_at', sixtyDaysAgo)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows = data ?? [];
  const sessionIds = rows
    .map((r) => r.session_id)
    .filter((id): id is string => !!id);
  const setsMap = await getSessionSetsBySessionIds(sessionIds);

  return rows.map((r) => {
    const session = Array.isArray(r.sessions) ? r.sessions[0] : r.sessions;
    const buckets = r.session_id ? setsMap.get(r.session_id) : undefined;
    return {
      session_rpe: r.session_rpe ?? null,
      actual_sets: buckets?.primary ?? [],
      planned_sets: session?.planned_sets ?? null,
      containedRehabSets: buckets?.containedRehabSets ?? false,
    };
  });
}

export interface JitWeeklyLogRow {
  actual_sets: ActualSet[];
  auxiliary_sets: ActualSet[];
  sessions:
    | { primary_lift: string | null; week_number: number; program_id: string | null }
    | { primary_lift: string | null; week_number: number; program_id: string | null }[]
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
      'session_id, sessions!inner(primary_lift, week_number, program_id)'
    )
    .eq('user_id', userId)
    .eq('sessions.program_id', programId)
    .eq('sessions.week_number', weekNumber);

  if (error) throw error;

  const rows = data ?? [];
  const sessionIds = rows
    .map((r) => r.session_id)
    .filter((id): id is string => !!id);
  const setsMap = await getSessionSetsBySessionIds(sessionIds);

  return rows.map((r) => {
    const buckets = r.session_id ? setsMap.get(r.session_id) : undefined;
    return {
      actual_sets: buckets?.primary ?? [],
      auxiliary_sets: buckets?.auxiliary ?? [],
      sessions: r.sessions,
    };
  });
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

/**
 * Distinct auxiliary exercise names from the lifter's last N completed
 * sessions, ordered newest-first. Drives the recency penalty in the JIT
 * aux scorer so the same core/aux pick isn't deterministically chosen
 * every session (GH#211). Includes both configured aux work and volume
 * top-up exercises (both land in `auxiliary_sets`).
 */
export async function fetchRecentAuxExerciseNames(
  userId: string,
  sessionLimit: number
): Promise<string[]> {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select('session_id, completed_at')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(sessionLimit);

  if (error) throw error;

  const rows = data ?? [];
  const sessionIds = rows
    .map((r) => r.session_id)
    .filter((id): id is string => !!id);
  if (sessionIds.length === 0) return [];

  const setsMap = await getSessionSetsBySessionIds(sessionIds);

  // Order matters — preserve the newest-first order from `rows` so the
  // scorer can index into the list. Dedupe within each session and across
  // sessions while keeping the most recent occurrence.
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of sessionIds) {
    const auxSets = setsMap.get(id)?.auxiliary ?? [];
    for (const s of auxSets) {
      const name = (s as { exercise?: string | null }).exercise;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      ordered.push(name);
    }
  }
  return ordered;
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
    suggested_overrides: data.suggested_overrides as Record<
      string,
      unknown
    > | null,
  };
}

export async function fetchUpcomingSessionLifts(
  programId: string,
  weekNumber: number,
  currentDayNumber: number
): Promise<string[]> {
  // Finding #13: tighten to actively-upcoming statuses. The previous
  // `.neq('completed')` accidentally counted missed/skipped sessions
  // toward "upcoming this week", which biased the top-up filter against
  // muscles those sessions would have hit — even though they're no longer
  // happening.
  const { data, error } = await typedSupabase
    .from('sessions')
    .select('primary_lift')
    .eq('program_id', programId)
    .eq('week_number', weekNumber)
    .gt('day_number', currentDayNumber)
    .in('status', ['planned', 'in_progress'])
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
    .or(
      `affected_date_end.is.null,affected_date_end.gte.${new Date().toISOString().slice(0, 10)}`
    );

  if (error) throw error;
  return (data ?? []) as JitDisruptionRow[];
}

export async function insertComparisonLog(row: {
  user_id: string;
  session_id: string;
  jit_input: Json;
  formula_output: Json;
  llm_output: Json;
  divergence: Json;
  strategy_used: string;
}): Promise<void> {
  const { error } = await typedSupabase
    .from('jit_comparison_logs')
    .insert([row]);
  if (error) throw error;
}

export async function updateSessionJitOutput(
  sessionId: string,
  update: {
    planned_sets: Json;
    jit_generated_at: string;
    jit_strategy: string;
    jit_input_snapshot: Json;
    jit_output_trace: Json;
  }
): Promise<void> {
  const { error } = await typedSupabase
    .from('sessions')
    .update(update)
    .eq('id', sessionId);
  if (error) throw error;
}

export async function insertChallengeReview(row: {
  user_id: string;
  session_id: string;
  score: number;
  verdict: string;
  concerns: Json;
  suggested_overrides: Json | null;
}): Promise<void> {
  const { error } = await typedSupabase.from('challenge_reviews').insert([row]);
  if (error) throw error;
}
