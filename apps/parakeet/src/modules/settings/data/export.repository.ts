// @spec docs/features/settings-and-tools/spec-export.md
import type { ActualSet } from '@parakeet/shared-types';
import { typedSupabase } from '@platform/supabase';

export interface ExportSessionRow {
  primary_lift: string | null;
  planned_date: string | null;
  completed_at: string | null;
  intensity_type: string | null;
  session_logs: {
    actual_sets: ActualSet[];
    auxiliary_sets: ActualSet[];
    session_rpe: number | null;
  }[];
}

export async function fetchCompletedSessionsForExport(
  userId: string
): Promise<ExportSessionRow[]> {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select(
      `
      id, primary_lift, planned_date, completed_at, intensity_type,
      session_logs(session_rpe)
    `
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true });

  if (error) throw error;

  const rows = data ?? [];
  const sessionIds = rows.map((r) => r.id as string);
  const { getSessionSetsBySessionIds } = await import('@modules/session');
  const setsMap = await getSessionSetsBySessionIds(sessionIds);

  return rows.map((row) => {
    const buckets = setsMap.get(row.id as string);
    const logs = Array.isArray(row.session_logs)
      ? row.session_logs
      : [row.session_logs].filter(Boolean);
    const mergedLogs = (logs.length > 0 ? logs : [{ session_rpe: null }]).map(
      (log) => ({
        actual_sets: buckets?.primary ?? [],
        auxiliary_sets: buckets?.auxiliary ?? [],
        session_rpe: (log?.session_rpe as number | null) ?? null,
      })
    );
    return {
      primary_lift: row.primary_lift,
      planned_date: row.planned_date,
      completed_at: row.completed_at,
      intensity_type: row.intensity_type,
      session_logs: mergedLogs,
    };
  });
}
