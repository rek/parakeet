// @spec docs/features/session/spec-set-persistence.md
// Per-set durability service. Writes each confirmed set to server immediately
// via the `set_logs` table, falling back to the sync queue on network error.
// See docs/features/session/design-durability.md.

import { useSessionStore } from '../store/sessionStore';
import { useSyncStore } from '@platform/store/syncStore';
import { captureException } from '@platform/utils/captureException';

import { upsertSetLog } from '../data/session.repository';
import { isNetworkError } from '../utils/isNetworkError';

export interface PersistSetArgs {
  sessionId: string;
  userId: string;
  kind: 'primary' | 'auxiliary';
  exercise: string | null;
  setNumber: number;
  weightGrams: number;
  repsCompleted: number;
  rpeActual?: number | null;
  actualRestSeconds?: number | null;
  exerciseType?: string | null;
  failed?: boolean;
  notes?: string | null;
  /** Rehab Mode pain-limited tag (GH#220). */
  painLimited?: boolean;
}

async function persistSetInternal(args: PersistSetArgs): Promise<void> {
  const loggedAt = new Date().toISOString();
  try {
    await upsertSetLog({
      sessionId: args.sessionId,
      userId: args.userId,
      kind: args.kind,
      exercise: args.exercise,
      setNumber: args.setNumber,
      weightGrams: args.weightGrams,
      repsCompleted: args.repsCompleted,
      rpeActual: args.rpeActual,
      actualRestSeconds: args.actualRestSeconds,
      exerciseType: args.exerciseType,
      failed: args.failed,
      notes: args.notes,
      painLimited: args.painLimited,
      loggedAt,
    });
    markSynced(args, loggedAt);
  } catch (err) {
    // Enqueue every failure (network or otherwise). `set_logs` is the sole
    // source of truth post-2026-04-19 (Migration B dropped the legacy JSONB
    // arrays from session_logs), so there is no `completeSession` batch-write
    // backstop — a silent drop here is permanent data loss. Non-network errors
    // (constraint, RLS) won't recover via retry, but the queue's MAX_RETRIES
    // drop path now alerts the user instead of dropping in silence.
    if (!isNetworkError(err)) captureException(err);
    useSyncStore.getState().enqueue({
      operation: 'upsert_set_log',
      payload: {
        sessionId: args.sessionId,
        userId: args.userId,
        kind: args.kind,
        exercise: args.exercise,
        setNumber: args.setNumber,
        weightGrams: args.weightGrams,
        repsCompleted: args.repsCompleted,
        rpeActual: args.rpeActual,
        actualRestSeconds: args.actualRestSeconds,
        exerciseType: args.exerciseType,
        failed: args.failed,
        notes: args.notes,
        painLimited: args.painLimited,
        loggedAt,
      },
    });
  }
}

function markSynced(args: PersistSetArgs, syncedAt: string): void {
  const store = useSessionStore.getState();
  if (store.sessionId !== args.sessionId) return;
  if (args.kind === 'primary') {
    store.markSetSynced(args.setNumber, syncedAt);
  } else if (args.exercise) {
    store.markAuxSetSynced(args.exercise, args.setNumber, syncedAt);
  }
}

/** Best-effort per-set write. Never throws; logs errors to Sentry. */
export function persistSet(args: PersistSetArgs): Promise<void> {
  return persistSetInternal(args).catch((err) => {
    captureException(err);
  });
}

/**
 * Fire persistSet for every completed-but-unsynced set in the current store.
 * Call before initSession overwrites state so nothing is lost, and on session
 * screen mount to recover from crashes / prior bugs.
 */
export async function flushUnsyncedSets(userId: string): Promise<void> {
  const state = useSessionStore.getState();
  if (!state.sessionId) return;

  const primary = state.actualSets.filter(
    (s) => s.is_completed && !s.synced_at
  );
  const aux = state.auxiliarySets.filter(
    (s) => s.is_completed && !s.synced_at
  );
  if (primary.length === 0 && aux.length === 0) return;

  const sessionId = state.sessionId;

  await Promise.all([
    ...primary.map((s) =>
      persistSet({
        sessionId,
        userId,
        kind: 'primary',
        exercise: null,
        setNumber: s.set_number,
        weightGrams: s.weight_grams,
        repsCompleted: s.reps_completed,
        rpeActual: s.rpe_actual ?? null,
        actualRestSeconds: s.actual_rest_seconds ?? null,
        exerciseType: null,
        failed: s.failed ?? false,
        painLimited: s.pain_limited ?? false,
      })
    ),
    ...aux.map((s) =>
      persistSet({
        sessionId,
        userId,
        kind: 'auxiliary',
        exercise: s.exercise,
        setNumber: s.set_number,
        weightGrams: s.weight_grams,
        repsCompleted: s.reps_completed,
        rpeActual: s.rpe_actual ?? null,
        actualRestSeconds: s.actual_rest_seconds ?? null,
        exerciseType: s.exercise_type ?? null,
        failed: s.failed ?? false,
      })
    ),
  ]);
}
