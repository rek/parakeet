// @spec docs/features/disruptions/spec-apply.md
import { DisruptionSchema, LiftSchema } from '@parakeet/shared-types';
import type {
  AdjustmentSuggestion,
  CreateDisruption,
  DisruptionWithSuggestions,
  Lift,
  SessionImpactPreview,
  TrainingDisruption,
} from '@parakeet/shared-types';
import { getDisabledPlates } from '@modules/settings';
import { suggestDisruptionAdjustment, plateIncrementKg } from '@parakeet/training-engine';
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
  unskipSessionsOnOrAfter,
  updateDisruptionEndDate as repoUpdateDisruptionEndDate,
  updateDisruptionAdjustmentApplied,
  updateDisruptionResolved,
  updateDisruptionSessionIds,
  updateSessionPlannedSets,
  updateSessionStatus,
} from '../data/disruptions.repository';
import type { SessionPartialRow } from '../data/disruptions.repository';
import { SORENESS_NUMERIC } from '../lib/disruption-presets';

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
    event_name: input.event_name ?? null,
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

  const session_impacts = buildSessionImpacts(
    suggested_adjustments,
    affectedSessions
  );

  return {
    ...parsedDisruption,
    suggested_adjustments,
    future_sessions_count,
    session_impacts,
  };
}

/** Build [day-of-week, lift, action, before → after] preview rows for the
 *  review screen by zipping suggestions against the current planned sets
 *  (finding #4). Sessions whose planned_sets are null (future JIT) get an
 *  entry with null before/after numbers so the row still renders with the
 *  action label. */
function buildSessionImpacts(
  suggestions: AdjustmentSuggestion[],
  affectedSessions: SessionRow[]
): SessionImpactPreview[] {
  const sessionsById = new Map(affectedSessions.map((s) => [s.id, s]));
  return suggestions
    .map((suggestion): SessionImpactPreview | null => {
      const session = sessionsById.get(suggestion.session_id);
      if (!session) return null;
      const parsedLift = LiftSchema.safeParse(session.primary_lift);
      const liftLabel = parsedLift.success ? parsedLift.data : 'unknown';
      const planned = parsePlannedSetsJson(session.planned_sets);
      const firstSet = planned?.[0];

      if (
        suggestion.action === 'weight_reduced' &&
        suggestion.reduction_pct != null
      ) {
        const before = firstSet?.weight_kg ?? null;
        const after =
          before !== null
            ? Math.round((before * (1 - suggestion.reduction_pct / 100)) * 10) /
              10
            : null;
        return {
          session_id: suggestion.session_id,
          planned_date: session.planned_date ?? null,
          primary_lift: liftLabel,
          action: suggestion.action,
          before_weight_kg: before,
          after_weight_kg: after,
        };
      }
      if (
        suggestion.action === 'reps_reduced' &&
        suggestion.reps_reduction != null
      ) {
        const before = firstSet?.reps ?? null;
        const after =
          before !== null
            ? Math.max(1, before - suggestion.reps_reduction)
            : null;
        return {
          session_id: suggestion.session_id,
          planned_date: session.planned_date ?? null,
          primary_lift: liftLabel,
          action: suggestion.action,
          before_reps: before,
          after_reps: after,
        };
      }
      return {
        session_id: suggestion.session_id,
        planned_date: session.planned_date ?? null,
        primary_lift: liftLabel,
        action: suggestion.action,
      };
    })
    .filter((row): row is SessionImpactPreview => row !== null);
}

export async function applyDisruptionAdjustment(
  disruptionId: string,
  userId: string
): Promise<void> {
  // Idempotency gate: fetchActiveDisruptionById only returns rows where
  // adjustment_applied IS NULL. We stamp an empty-array sentinel BEFORE the
  // per-session loop so a retry-after-partial-write doesn't compound the
  // reduction by running the loop again. The retry returns null and is a
  // no-op. See findings #2.
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

  // GH#209: round to the lifter's smallest reachable plate increment, not the
  // default 2.5kg. Otherwise a user with no 1.25kg plates gets prescribed
  // unreachable weights like 52.5kg.
  const disabledPlates = await getDisabledPlates();
  const weightIncrementKg = plateIncrementKg(disabledPlates);

  // Stamp pending BEFORE the loop so partial-write retries are gated out by
  // the fetchActiveDisruptionById null check.
  //
  // Trade-off: if the loop below crashes (e.g. network error mid-loop) the
  // disruption is permanently "applied" with an empty payload. Some sessions
  // may be adjusted, others not. There is no automatic recovery — the user
  // would need to report a fresh disruption. We accept this over compounding
  // a -40% reduction into -64% on retry.
  await updateDisruptionAdjustmentApplied(disruptionId, []);

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
          set.weight_kg * (1 - suggestion.reduction_pct! / 100),
          weightIncrementKg
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

/** Extend the shelf life of an active disruption by `days` days from today.
 *  Bundle C surfaces this through the today-screen prompt for ongoing
 *  disruptions older than their type-specific shelf life (finding #7). The
 *  underlying repo write only touches `affected_date_end`, which both the
 *  active-disruption query and the engine pipeline already honour. */
export async function extendDisruptionShelfLife(
  disruptionId: string,
  userId: string,
  days: number
): Promise<void> {
  const endDate = new Date();
  endDate.setUTCDate(endDate.getUTCDate() + days);
  const iso = endDate.toISOString().slice(0, 10);
  await repoUpdateDisruptionEndDate(disruptionId, userId, iso);
}

export async function resolveDisruption(
  disruptionId: string,
  userId: string,
  resolvedAt?: string
): Promise<void> {
  const resolvedDate = resolvedAt ?? new Date().toISOString();

  // Fetch the disruption (including adjustment_applied) BEFORE marking
  // resolved so we can identify which sessions were skipped by this
  // disruption and need restoring (finding #6).
  const beforeResolve = await fetchDisruptionById(disruptionId, userId);

  await updateDisruptionResolved(disruptionId, userId, resolvedDate);

  const sessionIds = await fetchDisruptionSessionIds(disruptionId);
  if (sessionIds.length > 0) {
    // For sessions this disruption skipped, restore status back to 'planned'
    // for any future or today's session — clearSessionJit then nulls
    // planned_sets so JIT regenerates them fresh.
    const today = new Date().toISOString().slice(0, 10);
    const previousSuggestions = parseAdjustmentSuggestionsJson(
      beforeResolve?.adjustment_applied
    );
    const skippedSessionIds = previousSuggestions
      .filter((s) => s.action === 'session_skipped')
      .map((s) => s.session_id);
    if (skippedSessionIds.length > 0) {
      await unskipSessionsOnOrAfter(skippedSessionIds, today);
    }
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
    Object.entries(soreness).filter(
      ([, level]) => level > SORENESS_NUMERIC.none
    )
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
