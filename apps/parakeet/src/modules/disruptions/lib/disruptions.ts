import { DisruptionSchema, LiftSchema } from '@parakeet/shared-types';
import type {
  CreateDisruption,
  DisruptionWithSuggestions,
  Lift,
  TrainingDisruption,
} from '@parakeet/shared-types';
import {
  roundToNearest,
  suggestDisruptionAdjustment,
} from '@parakeet/training-engine';
import type { DbRow } from '@platform/supabase';
import { typedSupabase } from '@platform/supabase';
import {
  parseAdjustmentSuggestionsJson,
  parsePlannedSetsJson,
} from '../data/disruption-codecs';

type SessionRow = Pick<
  DbRow<'sessions'>,
  'id' | 'primary_lift' | 'planned_sets' | 'status'
>;
type SuggestedSession = { id: string; primary_lift: Lift; status: string };

function toSuggestedSessions(rows: SessionRow[]): SuggestedSession[] {
  return rows.map((row) => ({
    id: row.id,
    primary_lift: LiftSchema.parse(row.primary_lift),
    status: row.status,
  }));
}

export async function reportDisruption(
  userId: string,
  input: CreateDisruption
): Promise<DisruptionWithSuggestions> {
  const { data: disruption, error } = await typedSupabase
    .from('disruptions')
    .insert({
      user_id: userId,
      disruption_type: input.disruption_type,
      severity: input.severity,
      affected_date_start: input.affected_date_start,
      affected_date_end: input.affected_date_end ?? null,
      affected_lifts: input.affected_lifts ?? null,
      description: input.description ?? null,
      session_ids_affected: input.session_ids_affected ?? null,
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;

  let affectedSessions: SessionRow[] = [];
  const explicitIds = input.session_ids_affected ?? [];
  if (explicitIds.length > 0) {
    affectedSessions =
      (
        await typedSupabase
          .from('sessions')
          .select('id, primary_lift, planned_sets, status')
          .in('id', explicitIds)
          .in('status', ['planned', 'in_progress'])
      ).data ?? [];
  } else {
    let query = typedSupabase
      .from('sessions')
      .select('id, primary_lift, planned_sets, status')
      .eq('user_id', userId)
      .in('status', ['planned', 'in_progress'])
      .gte('planned_date', input.affected_date_start);
    if (input.affected_date_end) {
      query = query.lte('planned_date', input.affected_date_end);
    }
    const rows = (await query).data ?? [];
    affectedSessions =
      input.affected_lifts && input.affected_lifts.length > 0
        ? rows.filter((s) => {
            const parsed = LiftSchema.safeParse(s.primary_lift);
            return (
              parsed.success && input.affected_lifts!.includes(parsed.data)
            );
          })
        : rows;
    const discoveredIds = affectedSessions.map((s) => s.id);
    if (discoveredIds.length > 0) {
      await typedSupabase
        .from('disruptions')
        .update({ session_ids_affected: discoveredIds })
        .eq('id', disruption.id);
    }
  }

  const parsedDisruption: TrainingDisruption =
    DisruptionSchema.parse(disruption);

  const future_sessions_count = affectedSessions.filter(
    (s) => s.planned_sets === null
  ).length;

  const suggested_adjustments = parseAdjustmentSuggestionsJson(
    suggestDisruptionAdjustment(
      parsedDisruption,
      toSuggestedSessions(affectedSessions)
    )
  );

  return { ...parsedDisruption, suggested_adjustments, future_sessions_count };
}

export async function applyDisruptionAdjustment(
  disruptionId: string,
  userId: string
): Promise<void> {
  const { data: disruption, error: disruptionError } = await typedSupabase
    .from('disruptions')
    .select('*')
    .eq('id', disruptionId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .is('adjustment_applied', null)
    .maybeSingle();

  if (disruptionError) throw disruptionError;
  if (!disruption) throw new Error('Disruption not found or already applied');

  const sessionIds = disruption.session_ids_affected ?? [];
  let affectedSessions: SessionRow[] = [];
  if (sessionIds.length > 0) {
    affectedSessions =
      (
        await typedSupabase
          .from('sessions')
          .select('id, primary_lift, planned_sets, status')
          .in('id', sessionIds)
      ).data ?? [];
  } else if (disruption.affected_date_start) {
    let query = typedSupabase
      .from('sessions')
      .select('id, primary_lift, planned_sets, status')
      .eq('user_id', userId)
      .in('status', ['planned', 'in_progress'])
      .gte('planned_date', disruption.affected_date_start);
    if (disruption.affected_date_end) {
      query = query.lte('planned_date', disruption.affected_date_end);
    }
    const rows = (await query).data ?? [];
    affectedSessions =
      disruption.affected_lifts && disruption.affected_lifts.length > 0
        ? rows.filter((s) => {
            const parsed = LiftSchema.safeParse(s.primary_lift);
            return (
              parsed.success && disruption.affected_lifts!.includes(parsed.data)
            );
          })
        : rows;
  }

  const parsedDisruption: TrainingDisruption =
    DisruptionSchema.parse(disruption);
  const suggestions = parseAdjustmentSuggestionsJson(
    suggestDisruptionAdjustment(
      parsedDisruption,
      toSuggestedSessions(affectedSessions)
    )
  );

  for (const suggestion of suggestions) {
    if (
      suggestion.action === 'weight_reduced' &&
      suggestion.reduction_pct != null
    ) {
      const session = affectedSessions.find(
        (s) => s.id === suggestion.session_id
      );
      const sets = parsePlannedSetsJson(session?.planned_sets);
      if (!sets) continue;

      const adjustedSets = sets.map((set) => ({
        ...set,
        weight_kg: roundToNearest(
          set.weight_kg * (1 - suggestion.reduction_pct! / 100)
        ),
      }));

      await typedSupabase
        .from('sessions')
        .update({ planned_sets: adjustedSets })
        .eq('id', suggestion.session_id);
    }

    if (suggestion.action === 'session_skipped') {
      await typedSupabase
        .from('sessions')
        .update({ status: 'skipped' })
        .eq('id', suggestion.session_id);
    }

    if (
      suggestion.action === 'reps_reduced' &&
      suggestion.reps_reduction != null
    ) {
      const session = affectedSessions.find(
        (s) => s.id === suggestion.session_id
      );
      const sets = parsePlannedSetsJson(session?.planned_sets);
      if (!sets) continue;

      const adjustedSets = sets.map((set) => ({
        ...set,
        reps: Math.max(1, set.reps - suggestion.reps_reduction!),
      }));

      await typedSupabase
        .from('sessions')
        .update({ planned_sets: adjustedSets })
        .eq('id', suggestion.session_id);
    }
  }

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

export async function resolveDisruption(
  disruptionId: string,
  userId: string,
  resolvedAt?: string
): Promise<void> {
  const resolvedDate = resolvedAt ?? new Date().toISOString();

  await typedSupabase
    .from('disruptions')
    .update({ status: 'resolved', resolved_at: resolvedDate })
    .eq('id', disruptionId)
    .eq('user_id', userId);

  const { data: disruption } = await typedSupabase
    .from('disruptions')
    .select('session_ids_affected')
    .eq('id', disruptionId)
    .single();

  const sessionIds = disruption?.session_ids_affected ?? [];
  if (sessionIds.length > 0) {
    await typedSupabase
      .from('sessions')
      .update({ planned_sets: null, jit_generated_at: null })
      .in('id', sessionIds)
      .in('status', ['planned']);
  }
}

export async function getActiveDisruptions(userId: string) {
  const { data, error } = await typedSupabase
    .from('disruptions')
    .select(
      'id, disruption_type, severity, affected_lifts, description, affected_date_end'
    )
    .eq('user_id', userId)
    .neq('status', 'resolved')
    .order('reported_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getDisruptionHistory(
  userId: string,
  pagination: { page: number; pageSize: number }
) {
  const from = pagination.page * pagination.pageSize;
  const to = from + pagination.pageSize - 1;

  const { data, count, error } = await typedSupabase
    .from('disruptions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('reported_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { items: data ?? [], total: count ?? 0 };
}

export async function getDisruption(disruptionId: string, userId: string) {
  const { data, error } = await typedSupabase
    .from('disruptions')
    .select('*')
    .eq('id', disruptionId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function applyUnprogrammedEventSoreness(
  userId: string,
  soreness: Record<string, number>
): Promise<void> {
  const ratings = Object.fromEntries(
    Object.entries(soreness).filter(([, level]) => level > 1)
  );
  if (Object.keys(ratings).length === 0) return;

  const { data: inProgressSession } = await typedSupabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .maybeSingle();

  await typedSupabase.from('soreness_checkins').insert({
    user_id: userId,
    session_id: inProgressSession?.id ?? null,
    ratings,
    skipped: false,
  });
}
