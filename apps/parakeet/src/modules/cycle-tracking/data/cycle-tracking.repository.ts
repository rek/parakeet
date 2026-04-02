import { typedSupabase } from '@platform/supabase';

import type { CycleConfig, PeriodStartEntry } from '../lib/cycle-tracking';

export async function fetchCycleConfig(
  userId: string
): Promise<CycleConfig | null> {
  const { data, error } = await typedSupabase
    .from('cycle_tracking')
    .select('is_enabled, cycle_length_days, last_period_start')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    is_enabled: data.is_enabled,
    cycle_length_days: data.cycle_length_days,
    last_period_start: data.last_period_start ?? null,
  };
}

export async function insertDefaultCycleConfig(
  userId: string,
  defaults: CycleConfig
): Promise<void> {
  const { error } = await typedSupabase
    .from('cycle_tracking')
    .insert({ user_id: userId, ...defaults });
  if (error) throw error;
}

export async function upsertCycleConfig(
  userId: string,
  update: Partial<
    Pick<CycleConfig, 'is_enabled' | 'cycle_length_days' | 'last_period_start'>
  >
): Promise<void> {
  const { error } = await typedSupabase
    .from('cycle_tracking')
    .upsert(
      { user_id: userId, ...update, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
}

export async function fetchPeriodStartHistory(
  userId: string
): Promise<PeriodStartEntry[]> {
  const { data, error } = await typedSupabase
    .from('period_starts')
    .select('id, start_date')
    .eq('user_id', userId)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertPeriodStart(
  userId: string,
  startDate: string
): Promise<void> {
  const { error } = await typedSupabase
    .from('period_starts')
    .upsert(
      { user_id: userId, start_date: startDate },
      { onConflict: 'user_id,start_date' }
    );
  if (error) throw error;
}

export async function deletePeriodStartById(
  userId: string,
  entryId: string
): Promise<void> {
  const { error } = await typedSupabase
    .from('period_starts')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function updateSessionCyclePhase(
  userId: string,
  sessionId: string,
  phase: string
): Promise<void> {
  const { error } = await typedSupabase
    .from('session_logs')
    .update({ cycle_phase: phase })
    .eq('session_id', sessionId)
    .eq('user_id', userId);
  if (error) throw error;
}
