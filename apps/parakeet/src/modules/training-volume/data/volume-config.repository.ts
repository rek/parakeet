// @spec docs/features/volume/spec-volume-config.md
import type { MuscleGroup } from '@parakeet/shared-types';
import { typedSupabase } from '@platform/supabase';

export async function fetchBiologicalSexForVolume(
  userId: string
): Promise<'female' | 'male' | null> {
  const { data } = await typedSupabase
    .from('profiles')
    .select('biological_sex')
    .eq('id', userId)
    .single();
  return (data?.biological_sex as 'female' | 'male' | null) ?? null;
}

export async function fetchMuscleVolumeConfig(
  userId: string
): Promise<
  {
    muscle_group: string;
    mev_sets_per_week: number;
    mrv_sets_per_week: number;
  }[]
> {
  const { data, error } = await typedSupabase
    .from('muscle_volume_config')
    .select('muscle_group, mev_sets_per_week, mrv_sets_per_week')
    .eq('user_id', userId);

  if (error) throw error;
  return data ?? [];
}

export async function upsertMuscleVolumeConfig(
  userId: string,
  muscle: MuscleGroup,
  mev: number,
  mrv: number
): Promise<void> {
  const { error } = await typedSupabase.from('muscle_volume_config').upsert(
    {
      user_id: userId,
      muscle_group: muscle,
      mev_sets_per_week: mev,
      mrv_sets_per_week: mrv,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,muscle_group' }
  );
  if (error) throw error;
}

export async function deleteMuscleVolumeConfig(
  userId: string,
  muscle: MuscleGroup
): Promise<void> {
  const { error } = await typedSupabase
    .from('muscle_volume_config')
    .delete()
    .eq('user_id', userId)
    .eq('muscle_group', muscle);
  if (error) throw error;
}
