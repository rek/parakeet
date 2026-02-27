import { supabase } from './supabase'
import { computeCyclePhase } from '@parakeet/training-engine'
import type { CycleContext } from '@parakeet/training-engine'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CycleConfig {
  is_enabled: boolean
  cycle_length_days: number
  last_period_start: string | null // ISO date string YYYY-MM-DD
}

// ── Data access ───────────────────────────────────────────────────────────────

export async function getCycleConfig(userId: string): Promise<CycleConfig> {
  const { data, error } = await supabase
    .from('cycle_tracking')
    .select('is_enabled, cycle_length_days, last_period_start')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error

  if (!data) {
    // First access — create default row
    const defaults: CycleConfig = {
      is_enabled: false,
      cycle_length_days: 28,
      last_period_start: null,
    }
    const { error: insertError } = await supabase
      .from('cycle_tracking')
      .insert({ user_id: userId, ...defaults })
    if (insertError) throw insertError
    return defaults
  }

  return {
    is_enabled: data.is_enabled,
    cycle_length_days: data.cycle_length_days,
    last_period_start: data.last_period_start ?? null,
  }
}

export async function updateCycleConfig(
  userId: string,
  update: Partial<Pick<CycleConfig, 'is_enabled' | 'cycle_length_days' | 'last_period_start'>>,
): Promise<void> {
  const { error } = await supabase
    .from('cycle_tracking')
    .upsert(
      { user_id: userId, ...update, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (error) throw error
}

export async function getCurrentCycleContext(userId: string): Promise<CycleContext | null> {
  const config = await getCycleConfig(userId)
  if (!config.is_enabled || !config.last_period_start) return null
  return computeCyclePhase(new Date(config.last_period_start), config.cycle_length_days)
}

export async function stampCyclePhaseOnSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  const context = await getCurrentCycleContext(userId)
  if (!context) return
  const { error } = await supabase
    .from('session_logs')
    .update({ cycle_phase: context.phase })
    .eq('session_id', sessionId)
    .eq('user_id', userId)
  if (error) throw error
}
