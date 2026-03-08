import { computeCyclePhase } from '@parakeet/training-engine'
import type { CycleContext } from '@parakeet/training-engine'
import { typedSupabase } from '@platform/supabase'

export interface CycleConfig {
  is_enabled: boolean
  cycle_length_days: number
  last_period_start: string | null
}

export async function getCycleConfig(userId: string): Promise<CycleConfig> {
  const { data, error } = await typedSupabase
    .from('cycle_tracking')
    .select('is_enabled, cycle_length_days, last_period_start')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error

  if (!data) {
    const defaults: CycleConfig = {
      is_enabled: false,
      cycle_length_days: 28,
      last_period_start: null,
    }
    const { error: insertError } = await typedSupabase
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
  const { error } = await typedSupabase
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

// ── Period start history ──────────────────────────────────────────────────────

export interface PeriodStartEntry {
  id: string
  start_date: string // 'YYYY-MM-DD'
}

export async function getPeriodStartHistory(userId: string): Promise<PeriodStartEntry[]> {
  const { data, error } = await typedSupabase
    .from('period_starts')
    .select('id, start_date')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function addPeriodStart(userId: string, startDate: string): Promise<PeriodStartEntry[]> {
  const { error: insertError } = await typedSupabase
    .from('period_starts')
    .upsert({ user_id: userId, start_date: startDate }, { onConflict: 'user_id,start_date' })
  if (insertError) throw insertError

  const history = await getPeriodStartHistory(userId)
  const mostRecent = history[0]?.start_date ?? null
  await updateCycleConfig(userId, { last_period_start: mostRecent })
  return history
}

export async function deletePeriodStart(userId: string, entryId: string): Promise<PeriodStartEntry[]> {
  const { error } = await typedSupabase
    .from('period_starts')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId)
  if (error) throw error

  const history = await getPeriodStartHistory(userId)
  const mostRecent = history[0]?.start_date ?? null
  await updateCycleConfig(userId, { last_period_start: mostRecent })
  return history
}

export async function stampCyclePhaseOnSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  // No-ops when cycle tracking is disabled or no period start date is recorded.
  const context = await getCurrentCycleContext(userId)
  if (!context) return
  const { error } = await typedSupabase
    .from('session_logs')
    .update({ cycle_phase: context.phase })
    .eq('session_id', sessionId)
    .eq('user_id', userId)
  if (error) throw error
}
