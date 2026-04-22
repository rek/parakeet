// @spec docs/features/settings-and-tools/spec-bar-weight.md
import {
  deleteProfileById,
  deleteTableForUser,
} from '../data/reset.repository';

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
    'performance_metrics',
    'session_logs',
    'sessions',
    'programs',
    'lifter_maxes',
    'formula_configs',
    'rest_configs',
    'muscle_volume_config',
    'warmup_configs',
    'auxiliary_exercises',
    'period_starts',
    'cycle_tracking',
  ] as const;

  for (const table of tables) {
    await deleteTableForUser(table, userId);
  }

  // profiles uses `id` (mirrors auth.users.id), not `user_id`
  await deleteProfileById(userId);
}
