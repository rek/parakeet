// @spec docs/features/disruptions/spec-adjuster.md
import type { DbInsert, DbRow, Json } from '@platform/supabase';
import { typedSupabase } from '@platform/supabase';

export type DisruptionRow = DbRow<'disruptions'>;
export type SessionPartialRow = Pick<
  DbRow<'sessions'>,
  'id' | 'primary_lift' | 'planned_sets' | 'status' | 'planned_date'
>;

export async function insertDisruption(
  input: DbInsert<'disruptions'>
): Promise<DisruptionRow> {
  const { data, error } = await typedSupabase
    .from('disruptions')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchSessionsByIds(
  ids: string[]
): Promise<SessionPartialRow[]> {
  const { data } = await typedSupabase
    .from('sessions')
    .select('id, primary_lift, planned_sets, status, planned_date')
    .in('id', ids)
    .in('status', ['planned', 'in_progress']);
  return data ?? [];
}

export async function fetchSessionsByDateRange(
  userId: string,
  dateStart: string,
  dateEnd: string | null | undefined
): Promise<SessionPartialRow[]> {
  let query = typedSupabase
    .from('sessions')
    .select('id, primary_lift, planned_sets, status, planned_date')
    .eq('user_id', userId)
    .in('status', ['planned', 'in_progress'])
    .gte('planned_date', dateStart);
  if (dateEnd) {
    query = query.lte('planned_date', dateEnd);
  }
  const { data } = await query;
  return data ?? [];
}

export async function updateDisruptionSessionIds(
  disruptionId: string,
  sessionIds: string[]
): Promise<void> {
  await typedSupabase
    .from('disruptions')
    .update({ session_ids_affected: sessionIds })
    .eq('id', disruptionId);
}

export async function fetchActiveDisruptionById(
  disruptionId: string,
  userId: string
): Promise<DisruptionRow | null> {
  const { data, error } = await typedSupabase
    .from('disruptions')
    .select('*')
    .eq('id', disruptionId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .is('adjustment_applied', null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchSessionsByIdsUnfiltered(
  ids: string[]
): Promise<SessionPartialRow[]> {
  const { data } = await typedSupabase
    .from('sessions')
    .select('id, primary_lift, planned_sets, status, planned_date')
    .in('id', ids);
  return data ?? [];
}

export async function updateSessionPlannedSets(
  sessionId: string,
  plannedSets: Json
): Promise<void> {
  await typedSupabase
    .from('sessions')
    .update({ planned_sets: plannedSets })
    .eq('id', sessionId);
}

export async function updateSessionStatus(
  sessionId: string,
  status: string
): Promise<void> {
  await typedSupabase.from('sessions').update({ status }).eq('id', sessionId);
}

export async function updateDisruptionAdjustmentApplied(
  disruptionId: string,
  suggestions: Json
): Promise<void> {
  await typedSupabase
    .from('disruptions')
    .update({ adjustment_applied: suggestions })
    .eq('id', disruptionId);
}

export async function updateDisruptionEndDate(
  disruptionId: string,
  userId: string,
  endDate: string
): Promise<void> {
  const { error } = await typedSupabase
    .from('disruptions')
    .update({ affected_date_end: endDate })
    .eq('id', disruptionId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function updateDisruptionResolved(
  disruptionId: string,
  userId: string,
  resolvedAt: string
): Promise<void> {
  await typedSupabase
    .from('disruptions')
    .update({ status: 'resolved', resolved_at: resolvedAt })
    .eq('id', disruptionId)
    .eq('user_id', userId);
}

export async function fetchDisruptionSessionIds(
  disruptionId: string
): Promise<string[]> {
  const { data } = await typedSupabase
    .from('disruptions')
    .select('session_ids_affected')
    .eq('id', disruptionId)
    .single();
  return data?.session_ids_affected ?? [];
}

export async function clearSessionJit(sessionIds: string[]): Promise<void> {
  await typedSupabase
    .from('sessions')
    .update({ planned_sets: null, jit_generated_at: null })
    .in('id', sessionIds)
    .in('status', ['planned']);
}

/** Restore status 'skipped' → 'planned' for the given sessions when their
 *  planned_date is on/after `dateOnOrAfter` (YYYY-MM-DD). Used by
 *  resolveDisruption so resolving a major disruption unskips the future
 *  sessions it had skipped (finding #6). */
export async function unskipSessionsOnOrAfter(
  sessionIds: string[],
  dateOnOrAfter: string
): Promise<void> {
  await typedSupabase
    .from('sessions')
    .update({ status: 'planned' })
    .in('id', sessionIds)
    .eq('status', 'skipped')
    .gte('planned_date', dateOnOrAfter);
}

export async function fetchActiveDisruptions(userId: string) {
  // event_name is selected so the chip can render the event label instead of
  // mashing it into description (finding #8). Narrow `*` to the columns the
  // UI actually consumes so we don't accidentally widen the shape downstream.
  const { data, error } = await typedSupabase
    .from('disruptions')
    .select(
      'id, disruption_type, severity, affected_lifts, description, affected_date_end, event_name'
    )
    .eq('user_id', userId)
    .neq('status', 'resolved')
    .or(
      `affected_date_end.is.null,affected_date_end.gte.${new Date().toISOString().slice(0, 10)}`
    )
    .order('reported_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchDisruptionHistory(
  userId: string,
  from: number,
  to: number
): Promise<{ items: DisruptionRow[]; total: number }> {
  const { data, count, error } = await typedSupabase
    .from('disruptions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('reported_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { items: data ?? [], total: count ?? 0 };
}

export async function fetchDisruptionById(
  disruptionId: string,
  userId: string
): Promise<DisruptionRow | null> {
  const { data, error } = await typedSupabase
    .from('disruptions')
    .select('*')
    .eq('id', disruptionId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchInProgressSessionId(
  userId: string
): Promise<{ id: string } | null> {
  const { data } = await typedSupabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .maybeSingle();
  return data;
}

export async function insertSorenessCheckin(input: {
  userId: string;
  sessionId: string | null;
  ratings: Record<string, number>;
  skipped: boolean;
}): Promise<void> {
  const { error } = await typedSupabase.from('soreness_checkins').insert({
    user_id: input.userId,
    session_id: input.sessionId,
    ratings: input.ratings,
    skipped: input.skipped,
    recorded_at: new Date().toISOString(),
  });
  if (error) throw error;
}
