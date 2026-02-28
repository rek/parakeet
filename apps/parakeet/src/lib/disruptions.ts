import {
  suggestDisruptionAdjustment,
  roundToNearest,
} from '@parakeet/training-engine'
import type { CreateDisruption, DisruptionWithSuggestions } from '@parakeet/shared-types'
import { supabase } from './supabase'

// Report a disruption and return suggested adjustments for user review
export async function reportDisruption(
  userId: string,
  input: CreateDisruption,
): Promise<DisruptionWithSuggestions> {
  const { data: disruption, error } = await supabase
    .from('disruptions')
    .insert({
      user_id:              userId,
      disruption_type:      input.disruption_type,
      severity:             input.severity,
      affected_date_start:  input.affected_date_start,
      affected_date_end:    input.affected_date_end ?? null,
      affected_lifts:       input.affected_lifts ?? null,
      description:          input.description ?? null,
      session_ids_affected: input.session_ids_affected ?? null,
      status:               'active',
    })
    .select()
    .single()

  if (error) throw error

  let affectedSessions: SessionRow[] = []
  const explicitIds = input.session_ids_affected ?? []
  if (explicitIds.length > 0) {
    affectedSessions = (await supabase
      .from('sessions')
      .select('id, primary_lift, planned_sets, status')
      .in('id', explicitIds)
      .in('status', ['planned', 'in_progress'])
    ).data ?? []
  } else {
    let query = supabase
      .from('sessions')
      .select('id, primary_lift, planned_sets, status')
      .eq('user_id', userId)
      .in('status', ['planned', 'in_progress'])
      .gte('planned_date', input.affected_date_start)
    if (input.affected_date_end) {
      query = query.lte('planned_date', input.affected_date_end)
    }
    const rows = (await query).data ?? []
    affectedSessions = (input.affected_lifts && input.affected_lifts.length > 0)
      ? rows.filter((s) => input.affected_lifts!.includes(s.primary_lift))
      : rows
    const discoveredIds = affectedSessions.map((s) => s.id)
    if (discoveredIds.length > 0) {
      await supabase
        .from('disruptions')
        .update({ session_ids_affected: discoveredIds })
        .eq('id', disruption.id)
    }
  }

  const suggested_adjustments = suggestDisruptionAdjustment(disruption, affectedSessions)

  return { ...disruption, suggested_adjustments }
}

// Apply suggested adjustments to affected sessions (after user confirms)
export async function applyDisruptionAdjustment(
  disruptionId: string,
  userId: string,
): Promise<void> {
  const { data: disruption } = await supabase
    .from('disruptions')
    .select('*')
    .eq('id', disruptionId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .is('adjustment_applied', null)
    .single()

  if (!disruption) throw new Error('Disruption not found or already applied')

  const sessionIds = disruption.session_ids_affected ?? []
  let affectedSessions: SessionRow[] = []
  if (sessionIds.length > 0) {
    affectedSessions = (await supabase
      .from('sessions')
      .select('id, primary_lift, planned_sets, status')
      .in('id', sessionIds)
    ).data ?? []
  } else if (disruption.affected_date_start) {
    let query = supabase
      .from('sessions')
      .select('id, primary_lift, planned_sets, status')
      .eq('user_id', userId)
      .in('status', ['planned', 'in_progress'])
      .gte('planned_date', disruption.affected_date_start)
    if (disruption.affected_date_end) {
      query = query.lte('planned_date', disruption.affected_date_end)
    }
    const rows = (await query).data ?? []
    affectedSessions = (disruption.affected_lifts && disruption.affected_lifts.length > 0)
      ? rows.filter((s) => disruption.affected_lifts!.includes(s.primary_lift))
      : rows
  }

  const suggestions = suggestDisruptionAdjustment(disruption, affectedSessions)

  for (const suggestion of suggestions) {
    if (suggestion.action === 'weight_reduced' && suggestion.reduction_pct != null) {
      const session = affectedSessions.find((s) => s.id === suggestion.session_id)
      const sets = session?.planned_sets as PlannedSet[] | null
      if (!sets) continue

      const adjustedSets = sets.map((set) => ({
        ...set,
        weight_kg: roundToNearest(set.weight_kg * (1 - suggestion.reduction_pct! / 100)),
      }))

      await supabase
        .from('sessions')
        .update({ planned_sets: adjustedSets })
        .eq('id', suggestion.session_id)
    }

    if (suggestion.action === 'session_skipped') {
      await supabase
        .from('sessions')
        .update({ status: 'skipped' })
        .eq('id', suggestion.session_id)
    }

    if (suggestion.action === 'reps_reduced' && suggestion.reps_reduction != null) {
      const session = affectedSessions.find((s) => s.id === suggestion.session_id)
      const sets = session?.planned_sets as PlannedSet[] | null
      if (!sets) continue

      const adjustedSets = sets.map((set) => ({
        ...set,
        reps: Math.max(1, set.reps - suggestion.reps_reduction!),
      }))

      await supabase
        .from('sessions')
        .update({ planned_sets: adjustedSets })
        .eq('id', suggestion.session_id)
    }
  }

  await supabase
    .from('disruptions')
    .update({ adjustment_applied: suggestions })
    .eq('id', disruptionId)
}

// Resolve a disruption; optionally specify when recovery occurred
export async function resolveDisruption(
  disruptionId: string,
  userId: string,
  resolvedAt?: string,
): Promise<void> {
  const resolvedDate = resolvedAt ?? new Date().toISOString()

  await supabase
    .from('disruptions')
    .update({ status: 'resolved', resolved_at: resolvedDate })
    .eq('id', disruptionId)
    .eq('user_id', userId)

  // Always clear planned_sets on future planned sessions so JIT regenerates without disruption
  const { data: disruption } = await supabase
    .from('disruptions')
    .select('session_ids_affected')
    .eq('id', disruptionId)
    .single()

  const sessionIds = disruption?.session_ids_affected ?? []
  if (sessionIds.length > 0) {
    await supabase
      .from('sessions')
      .update({ planned_sets: null, jit_generated_at: null })
      .in('id', sessionIds)
      .in('status', ['planned'])
  }
}

// Active disruptions for the Today screen banner
export async function getActiveDisruptions(userId: string) {
  const { data } = await supabase
    .from('disruptions')
    .select('id, disruption_type, severity, affected_lifts, description, affected_date_end')
    .eq('user_id', userId)
    .neq('status', 'resolved')
    .order('created_at', { ascending: false })
  return data ?? []
}

// Full history for the disruption history view
export async function getDisruptionHistory(
  userId: string,
  pagination: { page: number; pageSize: number },
) {
  const from = pagination.page * pagination.pageSize
  const to = from + pagination.pageSize - 1

  const { data, count } = await supabase
    .from('disruptions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to)

  return { items: data ?? [], total: count ?? 0 }
}

// Full detail of a single disruption
export async function getDisruption(disruptionId: string, userId: string) {
  const { data } = await supabase
    .from('disruptions')
    .select('*')
    .eq('id', disruptionId)
    .eq('user_id', userId)
    .single()
  return data
}

// --- Local types ---

interface SessionRow {
  id: string
  primary_lift: string
  planned_sets: unknown
  status: string
}

interface PlannedSet {
  weight_kg: number
  reps: number
  [key: string]: unknown
}
