import { DEFAULT_MRV_MEV_CONFIG } from '@parakeet/training-engine'
import type { MrvMevConfig, MuscleGroup } from '@parakeet/training-engine'
import { supabase } from './supabase'

export async function getMrvMevConfig(userId: string): Promise<MrvMevConfig> {
  const { data } = await supabase
    .from('muscle_volume_config')
    .select('muscle, mev, mrv')
    .eq('user_id', userId)

  const config = { ...DEFAULT_MRV_MEV_CONFIG }
  for (const row of data ?? []) {
    config[row.muscle as MuscleGroup] = { mev: row.mev, mrv: row.mrv }
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
  await supabase.from('muscle_volume_config').upsert(
    {
      user_id: userId,
      muscle,
      mev: update.mev ?? current.mev,
      mrv: update.mrv ?? current.mrv,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,muscle' },
  )
}

export async function resetMuscleToDefault(userId: string, muscle: MuscleGroup): Promise<void> {
  await supabase
    .from('muscle_volume_config')
    .delete()
    .eq('user_id', userId)
    .eq('muscle', muscle)
}
