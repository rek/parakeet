import type { WarmupPresetName, WarmupProtocol } from '@parakeet/training-engine'
import type { Lift } from '@parakeet/shared-types'
import { supabase } from './supabase'

export async function getWarmupConfig(
  userId: string,
  lift: Lift,
  biologicalSex?: 'female' | 'male',
): Promise<WarmupProtocol> {
  const { data } = await supabase
    .from('warmup_configs')
    .select('protocol, custom_steps')
    .eq('user_id', userId)
    .eq('lift', lift)
    .maybeSingle()

  const defaultPreset: WarmupPresetName = biologicalSex === 'female' ? 'standard_female' : 'standard'
  if (!data) return { type: 'preset', name: defaultPreset }
  if (data.protocol === 'custom') return { type: 'custom', steps: data.custom_steps }
  return { type: 'preset', name: data.protocol as WarmupPresetName }
}

export async function getAllWarmupConfigs(
  userId: string,
  biologicalSex?: 'female' | 'male',
): Promise<Record<Lift, WarmupProtocol>> {
  const { data } = await supabase
    .from('warmup_configs')
    .select('lift, protocol, custom_steps')
    .eq('user_id', userId)

  const defaultPreset: WarmupPresetName = biologicalSex === 'female' ? 'standard_female' : 'standard'
  const defaults: Record<Lift, WarmupProtocol> = {
    squat:    { type: 'preset', name: defaultPreset },
    bench:    { type: 'preset', name: defaultPreset },
    deadlift: { type: 'preset', name: defaultPreset },
  }
  for (const row of data ?? []) {
    defaults[row.lift as Lift] =
      row.protocol === 'custom'
        ? { type: 'custom', steps: row.custom_steps }
        : { type: 'preset', name: row.protocol as WarmupPresetName }
  }
  return defaults
}

export async function updateWarmupConfig(
  userId: string,
  lift: Lift,
  protocol: WarmupProtocol,
): Promise<void> {
  await supabase.from('warmup_configs').upsert(
    {
      user_id: userId,
      lift,
      protocol: protocol.type === 'custom' ? 'custom' : protocol.name,
      custom_steps: protocol.type === 'custom' ? protocol.steps : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,lift' },
  )
}

export async function resetWarmupConfig(userId: string, lift: Lift): Promise<void> {
  await supabase.from('warmup_configs').delete().eq('user_id', userId).eq('lift', lift)
}
