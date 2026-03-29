import { toJson, typedSupabase } from '@platform/supabase';

export async function fetchWarmupConfig(
  userId: string,
  lift: string
): Promise<{ protocol: string; custom_steps: unknown } | null> {
  const { data, error } = await typedSupabase
    .from('warmup_configs')
    .select('protocol, custom_steps')
    .eq('user_id', userId)
    .eq('lift', lift)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function fetchAllWarmupConfigs(
  userId: string
): Promise<{ lift: string; protocol: string; custom_steps: unknown }[]> {
  const { data, error } = await typedSupabase
    .from('warmup_configs')
    .select('lift, protocol, custom_steps')
    .eq('user_id', userId);

  if (error) throw error;
  return data ?? [];
}

export async function upsertWarmupConfig(
  userId: string,
  lift: string,
  row: {
    protocol: string;
    custom_steps: unknown;
    updated_at: string;
  }
): Promise<void> {
  await typedSupabase.from('warmup_configs').upsert(
    {
      user_id: userId,
      lift,
      protocol: row.protocol,
      custom_steps: toJson(row.custom_steps),
      updated_at: row.updated_at,
    },
    { onConflict: 'user_id,lift' }
  );
}

export async function deleteWarmupConfig(
  userId: string,
  lift: string
): Promise<void> {
  await typedSupabase
    .from('warmup_configs')
    .delete()
    .eq('user_id', userId)
    .eq('lift', lift);
}
