import type { Lift, IntensityType } from '@parakeet/shared-types'
import { supabase } from './supabase'

// Shape consumed by JITInput.userRestOverrides (camelCase to match engine interface)
export interface RestOverride {
  lift?: Lift
  intensityType?: IntensityType
  restSeconds: number
}

// Fetch all overrides for a user — called once before JIT, passed as JITInput.userRestOverrides
export async function getUserRestOverrides(userId: string): Promise<RestOverride[]> {
  const { data, error } = await supabase
    .from('rest_configs')
    .select('lift, intensity_type, rest_seconds')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...(row.lift != null && { lift: row.lift as Lift }),
    ...(row.intensity_type != null && { intensityType: row.intensity_type as IntensityType }),
    restSeconds: row.rest_seconds as number,
  }))
}

// Upsert a single override; omit lift/intensityType to create a catch-all rule
export async function setRestOverride(
  userId: string,
  restSeconds: number,
  lift?: Lift,
  intensityType?: IntensityType,
): Promise<void> {
  const { error } = await supabase.from('rest_configs').upsert({
    user_id:        userId,
    lift:           lift ?? null,
    intensity_type: intensityType ?? null,
    rest_seconds:   restSeconds,
    updated_at:     new Date().toISOString(),
  })
  if (error) throw error
}

// Delete all overrides for this user (Settings → Rest Timer → Reset to defaults)
export async function resetRestOverrides(userId: string): Promise<void> {
  const { error } = await supabase
    .from('rest_configs')
    .delete()
    .eq('user_id', userId)
  if (error) throw error
}
