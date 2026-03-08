import { typedSupabase } from '@platform/supabase';

export interface ExportSessionRow {
  primary_lift: string | null;
  planned_date: string | null;
  completed_at: string | null;
  intensity_type: string | null;
  session_logs: {
    actual_sets: unknown;
    auxiliary_sets: unknown;
    session_rpe: number | null;
  }[];
}

export async function fetchCompletedSessionsForExport(userId: string): Promise<ExportSessionRow[]> {
  const { data, error } = await typedSupabase
    .from('sessions')
    .select(`
      primary_lift, planned_date, completed_at, intensity_type,
      session_logs(actual_sets, auxiliary_sets, session_rpe)
    `)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    session_logs: Array.isArray(row.session_logs) ? row.session_logs : [row.session_logs].filter(Boolean) as ExportSessionRow['session_logs'],
  }));
}
