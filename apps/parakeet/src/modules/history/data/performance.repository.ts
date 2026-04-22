// @spec docs/features/history/spec-tab-upgrade.md
import type { Lift } from '@parakeet/shared-types';
import { typedSupabase } from '@platform/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActualSetSummary {
  set_number: number;
  weight_grams: number;
  reps_completed: number;
  rpe_actual?: number;
  actual_rest_seconds?: number;
  failed?: boolean;
  exercise?: string;
  exercise_type?: string;
}

interface SessionBuckets {
  primary: ActualSetSummary[];
  auxiliary: ActualSetSummary[];
}

// ── Internal: fetch per-session sets in one round trip ───────────────────────
// Reads from set_logs (authoritative post-backfill). Replaces the old path
// where session_logs.actual_sets / auxiliary_sets JSONB carried the same data.
// See docs/features/session/design-durability.md.

async function fetchSetLogsBySessionIds(
  sessionIds: string[]
): Promise<Map<string, SessionBuckets>> {
  const map = new Map<string, SessionBuckets>();
  if (sessionIds.length === 0) return map;

  const { data, error } = await typedSupabase
    .from('set_logs')
    .select(
      'session_id, kind, exercise, exercise_type, set_number, weight_grams, reps_completed, rpe_actual, actual_rest_seconds, failed'
    )
    .in('session_id', sessionIds)
    .order('set_number', { ascending: true });
  if (error) throw error;

  for (const row of data ?? []) {
    let bucket = map.get(row.session_id);
    if (!bucket) {
      bucket = { primary: [], auxiliary: [] };
      map.set(row.session_id, bucket);
    }
    const summary: ActualSetSummary = {
      set_number: row.set_number,
      weight_grams: row.weight_grams,
      reps_completed: row.reps_completed,
    };
    if (row.rpe_actual != null) summary.rpe_actual = row.rpe_actual;
    if (row.actual_rest_seconds != null)
      summary.actual_rest_seconds = row.actual_rest_seconds;
    if (row.failed) summary.failed = true;
    if (row.exercise) summary.exercise = row.exercise;
    if (row.exercise_type) summary.exercise_type = row.exercise_type;

    if (row.kind === 'primary') bucket.primary.push(summary);
    else bucket.auxiliary.push(summary);
  }
  return map;
}

function collectSessionIds(rows: { session_id: string | null }[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.session_id) ids.add(row.session_id);
  }
  return Array.from(ids);
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function fetchPerformanceByLift(
  userId: string,
  lift: Lift,
  fromDate?: Date
) {
  let query = typedSupabase
    .from('session_logs')
    .select(
      `
      id, session_id, completed_at, completion_pct, session_rpe,
      sessions!inner(primary_lift, intensity_type, block_number, week_number)
    `
    )
    .eq('user_id', userId)
    .eq('sessions.primary_lift', lift)
    .order('completed_at', { ascending: false });

  if (fromDate) {
    query = query.gte('completed_at', fromDate.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const setsMap = await fetchSetLogsBySessionIds(collectSessionIds(rows));
  return rows.map((row) => {
    const buckets = row.session_id ? setsMap.get(row.session_id) : undefined;
    return {
      ...row,
      actual_sets: buckets?.primary ?? [],
      auxiliary_sets: buckets?.auxiliary ?? [],
    };
  });
}

export async function fetchRecentSessionLogsForTrends(userId: string) {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select(
      `
      session_id, completion_pct, session_rpe,
      sessions!inner(primary_lift, intensity_type)
    `
    )
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(30);

  if (error) throw error;

  const rows = data ?? [];
  const setsMap = await fetchSetLogsBySessionIds(collectSessionIds(rows));
  return rows.map((row) => ({
    ...row,
    actual_sets: (row.session_id && setsMap.get(row.session_id)?.primary) ?? [],
  }));
}

export async function fetchWeeklySessionLogs(userId: string, fromDate: Date) {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select(
      'session_id, completed_at, sessions!inner(primary_lift, status)'
    )
    .eq('user_id', userId)
    .eq('sessions.status', 'completed')
    .gte('completed_at', fromDate.toISOString())
    .order('completed_at', { ascending: true });

  if (error) throw error;

  const rows = data ?? [];
  const setsMap = await fetchSetLogsBySessionIds(collectSessionIds(rows));
  return rows.map((row) => ({
    ...row,
    actual_sets: (row.session_id && setsMap.get(row.session_id)?.primary) ?? [],
  }));
}

export async function fetchRecentLiftHistory(
  userId: string,
  lift: Lift,
  limit: number
) {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select(
      'session_id, completed_at, completion_pct, session_rpe, sessions!inner(primary_lift)'
    )
    .eq('user_id', userId)
    .eq('sessions.primary_lift', lift)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows = data ?? [];
  const setsMap = await fetchSetLogsBySessionIds(collectSessionIds(rows));
  return rows.map((row) => ({
    ...row,
    actual_sets: (row.session_id && setsMap.get(row.session_id)?.primary) ?? [],
  }));
}
