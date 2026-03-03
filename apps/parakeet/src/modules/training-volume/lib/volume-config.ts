import {
  DEFAULT_MRV_MEV_CONFIG_FEMALE,
  DEFAULT_MRV_MEV_CONFIG_MALE,
  MUSCLE_GROUPS,
} from '@parakeet/training-engine'
import type { MrvMevConfig, MuscleGroup } from '@parakeet/training-engine'
import type { BiologicalSex } from '@modules/profile'
import { typedSupabase } from '@platform/supabase'

function isMuscleGroup(v: string): v is MuscleGroup {
  return (MUSCLE_GROUPS as readonly string[]).includes(v)
}

export async function getMrvMevConfig(
  userId: string,
  biologicalSex?: BiologicalSex | null,
): Promise<MrvMevConfig> {
  const { data } = await typedSupabase
    .from('muscle_volume_config')
    .select('muscle_group, mev_sets_per_week, mrv_sets_per_week')
    .eq('user_id', userId)

  const defaults =
    biologicalSex === 'female'
      ? DEFAULT_MRV_MEV_CONFIG_FEMALE
      : DEFAULT_MRV_MEV_CONFIG_MALE

  const config = { ...defaults }
  for (const row of data ?? []) {
    if (isMuscleGroup(row.muscle_group)) {
      config[row.muscle_group] = {
        mev: row.mev_sets_per_week,
        mrv: row.mrv_sets_per_week,
      }
    }
  }
  return config
}

export async function updateMuscleConfig(
  userId: string,
  muscle: MuscleGroup,
  update: { mev?: number; mrv?: number },
): Promise<void> {
  const existing = await getMrvMevConfig(userId)
  const current = existing[muscle]
  await typedSupabase.from('muscle_volume_config').upsert(
    {
      user_id: userId,
      muscle_group: muscle,
      mev_sets_per_week: update.mev ?? current.mev,
      mrv_sets_per_week: update.mrv ?? current.mrv,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,muscle_group' },
  )
}

export async function resetMuscleToDefault(
  userId: string,
  muscle: MuscleGroup,
): Promise<void> {
  await typedSupabase
    .from('muscle_volume_config')
    .delete()
    .eq('user_id', userId)
    .eq('muscle_group', muscle)
}
