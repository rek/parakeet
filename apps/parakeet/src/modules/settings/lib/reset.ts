import { typedSupabase } from '@platform/supabase'

export async function deleteAllUserData(userId: string): Promise<void> {
  // Delete in FK-safe order: children before parents
  const tables = [
    'jit_comparison_logs',
    'motivational_message_logs',
    'personal_records',
    'developer_suggestions',
    'cycle_reviews',
    'auxiliary_assignments',
    'disruptions',
    'recovery_snapshots',
    'weekly_body_reviews',
    'soreness_checkins',
    'session_logs',
    'sessions',
    'programs',
    'performance_metrics',
    'lifter_maxes',
    'formula_configs',
    'rest_configs',
    'muscle_volume_config',
    'warmup_configs',
    'auxiliary_exercises',
    'period_starts',
    'cycle_tracking',
  ] as const

  for (const table of tables) {
    const { error } = await typedSupabase
      .from(table)
      .delete()
      .eq('user_id', userId)
    if (error) throw new Error(`Failed to delete ${table}: ${error.message}`)
  }

  // profiles uses `id` (mirrors auth.users.id), not `user_id`
  const { error } = await typedSupabase
    .from('profiles')
    .delete()
    .eq('id', userId)
  if (error) throw new Error(`Failed to delete profiles: ${error.message}`)
}
