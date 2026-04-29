// @spec docs/features/wearable/spec-biometric-data.md
import { typedSupabase } from '@platform/supabase';
import {
  RecoverySnapshotSchema,
  type RecoverySnapshot,
  type RecoverySnapshotInsert,
} from '@parakeet/shared-types';

export async function upsertRecoverySnapshot(
  userId: string,
  snapshot: Omit<RecoverySnapshotInsert, 'user_id'>
): Promise<RecoverySnapshot> {
  const { data, error } = await typedSupabase
    .from('recovery_snapshots')
    .upsert(
      { ...snapshot, user_id: userId },
      { onConflict: 'user_id,date' }
    )
    .select('*')
    .single();
  if (error) throw error;
  return RecoverySnapshotSchema.parse(data);
}

export async function fetchTodaySnapshot(
  userId: string
): Promise<RecoverySnapshot | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await typedSupabase
    .from('recovery_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();
  if (error) throw error;
  return data ? RecoverySnapshotSchema.parse(data) : null;
}

export async function fetchSnapshotsForRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<RecoverySnapshot[]> {
  const { data, error } = await typedSupabase
    .from('recovery_snapshots')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => RecoverySnapshotSchema.parse(row));
}
