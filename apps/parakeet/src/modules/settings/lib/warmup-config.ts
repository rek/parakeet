import type { WarmupPresetName, WarmupProtocol } from '@parakeet/training-engine'
import type { Lift } from '@parakeet/shared-types'
import { typedSupabase, toJson } from '@platform/supabase'

function parseCustomSteps(value: unknown): Extract<WarmupProtocol, { type: 'custom' }>['steps'] {
  if (!Array.isArray(value)) return []
  return value
    .filter((step): step is { pct: number; reps: number } => {
      if (!step || typeof step !== 'object') return false
      const s = step as { pct?: unknown; reps?: unknown }
      return typeof s.pct === 'number' && Number.isFinite(s.pct)
        && typeof s.reps === 'number' && Number.isFinite(s.reps)
    })
    .map((step) => ({ pct: step.pct, reps: step.reps }))
}

export async function getWarmupConfig(
  userId: string,
  lift: Lift,
  biologicalSex?: 'female' | 'male',
): Promise<WarmupProtocol> {
  const { data, error } = await typedSupabase
    .from('warmup_configs')
    .select('protocol, custom_steps')
    .eq('user_id', userId)
    .eq('lift', lift)
    .maybeSingle()

  if (error) throw error
  const defaultPreset: WarmupPresetName = biologicalSex === 'female' ? 'standard_female' : 'standard'
  if (!data) return { type: 'preset', name: defaultPreset }
  if (data.protocol === 'custom') return { type: 'custom', steps: parseCustomSteps(data.custom_steps) }
  return { type: 'preset', name: data.protocol as WarmupPresetName }
}

export async function getAllWarmupConfigs(
  userId: string,
  biologicalSex?: 'female' | 'male',
): Promise<Record<Lift, WarmupProtocol>> {
  const { data, error } = await typedSupabase
    .from('warmup_configs')
    .select('lift, protocol, custom_steps')
    .eq('user_id', userId)

  if (error) throw error
  const defaultPreset: WarmupPresetName = biologicalSex === 'female' ? 'standard_female' : 'standard'
  const defaults: Record<Lift, WarmupProtocol> = {
    squat: { type: 'preset', name: defaultPreset },
    bench: { type: 'preset', name: defaultPreset },
    deadlift: { type: 'preset', name: defaultPreset },
  }
  for (const row of data ?? []) {
    defaults[row.lift as Lift] =
      row.protocol === 'custom'
        ? { type: 'custom', steps: parseCustomSteps(row.custom_steps) }
        : { type: 'preset', name: row.protocol as WarmupPresetName }
  }
  return defaults
}

export async function updateWarmupConfig(
  userId: string,
  lift: Lift,
  protocol: WarmupProtocol,
): Promise<void> {
  await typedSupabase.from('warmup_configs').upsert(
    {
      user_id: userId,
      lift,
      protocol: protocol.type === 'custom' ? 'custom' : protocol.name,
      custom_steps: protocol.type === 'custom' ? toJson(protocol.steps) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,lift' },
  )
}

export async function resetWarmupConfig(userId: string, lift: Lift): Promise<void> {
  await typedSupabase.from('warmup_configs').delete().eq('user_id', userId).eq('lift', lift)
}
