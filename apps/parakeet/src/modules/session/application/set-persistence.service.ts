// @spec docs/features/session/spec-set-persistence.md
// Per-set durability service. Writes each confirmed set to server immediately
// via the `set_logs` table, falling back to the sync queue on network error.
// See docs/features/session/design-durability.md.

import { useSessionStore } from '@platform/store/sessionStore';
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
      loggedAt,
    });
    markSynced(args, loggedAt);
  } catch (err) {
    if (isNetworkError(err)) {
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
          loggedAt,
        },
      });
      return;
    }
    // Non-network error (RLS, constraint, missing table): capture and move on.
    // We deliberately do not retry — legacy completeSession batch write still
    // covers the full session on End-tap during the dual-write rollout.
    captureException(err);
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
