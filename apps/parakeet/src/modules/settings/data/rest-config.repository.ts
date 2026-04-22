// @spec docs/features/settings-and-tools/spec-bar-weight.md
import { typedSupabase } from '@platform/supabase';

export interface RestConfigRow {
  lift: string | null;
  intensity_type: string | null;
  rest_seconds: number | null;
}

export async function fetchRestConfigs(
  userId: string
): Promise<RestConfigRow[]> {
  const { data, error } = await typedSupabase
    .from('rest_configs')
    .select('lift, intensity_type, rest_seconds')
    .eq('user_id', userId);

  if (error) throw error;
  return data ?? [];
}

export async function upsertRestConfig(
  userId: string,
  row: {
    lift: string | null;
    intensity_type: string | null;
    rest_seconds: number;
    updated_at: string;
  }
): Promise<void> {
  const { error } = await typedSupabase
    .from('rest_configs')
    .upsert({ user_id: userId, ...row });

  if (error) throw error;
}

export async function deleteRestConfigs(userId: string): Promise<void> {
  const { error } = await typedSupabase
    .from('rest_configs')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
}
