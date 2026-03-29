import { typedSupabase } from '@platform/supabase';

type UserTable =
  | 'jit_comparison_logs'
  | 'motivational_message_logs'
  | 'personal_records'
  | 'developer_suggestions'
  | 'cycle_reviews'
  | 'auxiliary_assignments'
  | 'disruptions'
  | 'recovery_snapshots'
  | 'weekly_body_reviews'
  | 'soreness_checkins'
  | 'performance_metrics'
  | 'session_logs'
  | 'sessions'
  | 'programs'
  | 'lifter_maxes'
  | 'formula_configs'
  | 'rest_configs'
  | 'muscle_volume_config'
  | 'warmup_configs'
  | 'auxiliary_exercises'
  | 'period_starts'
  | 'cycle_tracking';

export async function deleteTableForUser(
  table: UserTable,
  userId: string
): Promise<void> {
  const { error } = await typedSupabase
    .from(table)
    .delete()
    .eq('user_id', userId);
  if (error) throw new Error(`Failed to delete ${table}: ${error.message}`);
}

export async function deleteProfileById(userId: string): Promise<void> {
  const { error } = await typedSupabase
    .from('profiles')
    .delete()
    .eq('id', userId);
  if (error) throw new Error(`Failed to delete profiles: ${error.message}`);
}
