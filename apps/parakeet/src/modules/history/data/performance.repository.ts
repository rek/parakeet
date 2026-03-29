import { typedSupabase } from '@platform/supabase';
import type { Lift } from '@parakeet/shared-types';

export async function fetchPerformanceByLift(
  userId: string,
  lift: Lift,
  fromDate?: Date
) {
  let query = typedSupabase
    .from('session_logs')
    .select(
      `
      id, completed_at, completion_pct, session_rpe,
      actual_sets,
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
  return data ?? [];
}

export async function fetchRecentSessionLogsForTrends(userId: string) {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select(
      `
      completion_pct, session_rpe, actual_sets,
      sessions!inner(primary_lift, intensity_type)
    `
    )
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(30);

  if (error) throw error;
  return data ?? [];
}

export async function fetchPendingPerformanceMetrics(userId: string) {
  const { data, error } = await typedSupabase
    .from('performance_metrics')
    .select('*')
    .eq('user_id', userId)
    .eq('reviewed', false)
    .order('computed_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchWeeklySessionLogs(
  userId: string,
  fromDate: Date
) {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select('completed_at, actual_sets, sessions!inner(primary_lift, status)')
    .eq('user_id', userId)
    .eq('sessions.status', 'completed')
    .gte('completed_at', fromDate.toISOString())
    .order('completed_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchRecentLiftHistory(
  userId: string,
  lift: Lift,
  limit: number
) {
  const { data, error } = await typedSupabase
    .from('session_logs')
    .select(
      'completed_at, completion_pct, session_rpe, actual_sets, sessions!inner(primary_lift)'
    )
    .eq('user_id', userId)
    .eq('sessions.primary_lift', lift)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
