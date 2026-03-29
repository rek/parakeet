import { DisruptionSchema, LiftSchema } from '@parakeet/shared-types';
import type {
  CreateDisruption,
  DisruptionWithSuggestions,
  Lift,
  TrainingDisruption,
} from '@parakeet/shared-types';
import { suggestDisruptionAdjustment } from '@parakeet/training-engine';
import { roundToNearest } from '@shared/utils/weight';

import {
  parseAdjustmentSuggestionsJson,
  parsePlannedSetsJson,
} from '../data/disruption-codecs';
import {
  clearSessionJit,
  fetchActiveDisruptionById,
  fetchActiveDisruptions,
  fetchDisruptionById,
  fetchDisruptionHistory,
  fetchDisruptionSessionIds,
  fetchInProgressSessionId,
  fetchSessionsByDateRange,
  fetchSessionsByIds,
  fetchSessionsByIdsUnfiltered,
  insertDisruption,
  insertSorenessCheckin,
  updateDisruptionAdjustmentApplied,
  updateDisruptionEndDate as repoUpdateDisruptionEndDate,
  updateDisruptionResolved,
  updateDisruptionSessionIds,
  updateSessionPlannedSets,
  updateSessionStatus,
} from '../data/disruptions.repository';
import type { SessionPartialRow } from '../data/disruptions.repository';
import { SORENESS_NUMERIC } from './disruption-presets';

type SessionRow = SessionPartialRow;
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
  const disruption = await insertDisruption({
    user_id: userId,
    disruption_type: input.disruption_type,
    severity: input.severity,
    affected_date_start: input.affected_date_start,
    affected_date_end: input.affected_date_end ?? null,
    affected_lifts: input.affected_lifts ?? null,
    description: input.description ?? null,
    session_ids_affected: input.session_ids_affected ?? null,
    status: 'active',
  });

  let affectedSessions: SessionRow[] = [];
  const explicitIds = input.session_ids_affected ?? [];
  if (explicitIds.length > 0) {
    affectedSessions = await fetchSessionsByIds(explicitIds);
  } else {
    const rows = await fetchSessionsByDateRange(
      userId,
      input.affected_date_start,
      input.affected_date_end
    );
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
      await updateDisruptionSessionIds(disruption.id, discoveredIds);
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
  const disruption = await fetchActiveDisruptionById(disruptionId, userId);

  if (!disruption) throw new Error('Disruption not found or already applied');

  const sessionIds = disruption.session_ids_affected ?? [];
  let affectedSessions: SessionRow[] = [];
  if (sessionIds.length > 0) {
    affectedSessions = await fetchSessionsByIdsUnfiltered(sessionIds);
  } else if (disruption.affected_date_start) {
    const rows = await fetchSessionsByDateRange(
      userId,
      disruption.affected_date_start,
      disruption.affected_date_end
    );
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

      await updateSessionPlannedSets(suggestion.session_id, adjustedSets);
    }

    if (suggestion.action === 'session_skipped') {
      await updateSessionStatus(suggestion.session_id, 'skipped');
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

      await updateSessionPlannedSets(suggestion.session_id, adjustedSets);
    }
  }

  await updateDisruptionAdjustmentApplied(disruptionId, suggestions);
}

export async function updateDisruptionEndDate(
  disruptionId: string,
  userId: string,
  endDate: string
): Promise<void> {
  await repoUpdateDisruptionEndDate(disruptionId, userId, endDate);
}

export async function resolveDisruption(
  disruptionId: string,
  userId: string,
  resolvedAt?: string
): Promise<void> {
  const resolvedDate = resolvedAt ?? new Date().toISOString();

  await updateDisruptionResolved(disruptionId, userId, resolvedDate);

  const sessionIds = await fetchDisruptionSessionIds(disruptionId);
  if (sessionIds.length > 0) {
    await clearSessionJit(sessionIds);
  }
}

export async function getActiveDisruptions(userId: string) {
  return fetchActiveDisruptions(userId);
}

export async function getDisruptionHistory(
  userId: string,
  pagination: { page: number; pageSize: number }
) {
  const from = pagination.page * pagination.pageSize;
  const to = from + pagination.pageSize - 1;
  return fetchDisruptionHistory(userId, from, to);
}

export async function getDisruption(disruptionId: string, userId: string) {
  return fetchDisruptionById(disruptionId, userId);
}

export async function applyUnprogrammedEventSoreness(
  userId: string,
  soreness: Record<string, number>
): Promise<void> {
  const ratings = Object.fromEntries(
    Object.entries(soreness).filter(([, level]) => level > SORENESS_NUMERIC.none)
  );
  if (Object.keys(ratings).length === 0) return;

  const inProgressSession = await fetchInProgressSessionId(userId);

  await insertSorenessCheckin({
    userId,
    sessionId: inProgressSession?.id ?? null,
    ratings,
    skipped: false,
  });
}
