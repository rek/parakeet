import type { WarmupPresetName, WarmupProtocol } from '@parakeet/training-engine'
import type { Lift } from '@parakeet/shared-types'
import { supabase } from './supabase'

export async function getWarmupConfig(userId: string, lift: Lift): Promise<WarmupProtocol> {
  const { data } = await supabase
    .from('warmup_configs')
    .select('protocol, custom_steps')
    .eq('user_id', userId)
    .eq('lift', lift)
    .maybeSingle()

  if (!data) return { type: 'preset', name: 'standard' }
  if (data.protocol === 'custom') return { type: 'custom', steps: data.custom_steps }
  return { type: 'preset', name: data.protocol as WarmupPresetName }
}

export async function getAllWarmupConfigs(userId: string): Promise<Record<Lift, WarmupProtocol>> {
  const { data } = await supabase
    .from('warmup_configs')
    .select('lift, protocol, custom_steps')
    .eq('user_id', userId)

  const defaults: Record<Lift, WarmupProtocol> = {
    squat:    { type: 'preset', name: 'standard' },
    bench:    { type: 'preset', name: 'standard' },
    deadlift: { type: 'preset', name: 'standard' },
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
