import type { IntensityType, Lift } from '@parakeet/shared-types';
import { typedSupabase } from '@platform/supabase';

export interface RestOverride {
  lift?: Lift;
  intensityType?: IntensityType;
  restSeconds: number;
}

export async function getUserRestOverrides(
  userId: string
): Promise<RestOverride[]> {
  const { data, error } = await typedSupabase
    .from('rest_configs')
    .select('lift, intensity_type, rest_seconds')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...(row.lift != null && { lift: row.lift as Lift }),
    ...(row.intensity_type != null && {
      intensityType: row.intensity_type as IntensityType,
    }),
    restSeconds: row.rest_seconds as number,
  }));
}

export async function setRestOverride(
  userId: string,
  restSeconds: number,
  lift?: Lift,
  intensityType?: IntensityType
): Promise<void> {
  const { error } = await typedSupabase.from('rest_configs').upsert({
    user_id: userId,
    lift: lift ?? null,
    intensity_type: intensityType ?? null,
    rest_seconds: restSeconds,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function resetRestOverrides(userId: string): Promise<void> {
  const { error } = await typedSupabase
    .from('rest_configs')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}
