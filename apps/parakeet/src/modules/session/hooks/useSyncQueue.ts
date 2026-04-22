import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { stampCyclePhaseOnSession } from '@modules/cycle-tracking';
import { useNetworkStatus } from '@platform/network/useNetworkStatus';
import { useSessionStore } from '@platform/store/sessionStore';
import { useSyncStore } from '@platform/store/syncStore';
import { captureException } from '@platform/utils/captureException';
import { useQueryClient } from '@tanstack/react-query';

import { completeSession } from '../application/session.service';
import { upsertSetLog } from '../data/session.repository';
import { sessionQueries } from '../data/session.queries';
import { isNetworkError } from '../utils/isNetworkError';

export { isNetworkError };

const MAX_RETRIES = 5;

export function useSyncQueue() {
  const { isOnline } = useNetworkStatus();
  const { queue, dequeue, incrementRetry } = useSyncStore();
  const queryClient = useQueryClient();
  const processingRef = useRef(false);

  useEffect(() => {
    if (!isOnline || queue.length === 0 || processingRef.current) return;
    void drainQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, queue.length]);

  async function drainQueue() {
    if (processingRef.current) return;
    processingRef.current = true;

    let syncedCount = 0;

    try {
      for (const op of queue) {
        if (op.retryCount >= MAX_RETRIES) {
          dequeue(op.id);
          // Silent drop for per-set writes — they're best-effort and the
          // completeSession batch write still covers on End-tap during the
          // dual-write rollout window. Only alert on full-session failures.
          if (op.operation !== 'upsert_set_log') {
            Alert.alert(
              'Sync Failed',
              'Your workout data could not be saved after multiple attempts. Please check your connection and try again.'
            );
          }
          continue;
        }

        try {
          if (op.operation === 'complete_session') {
            const {
              sessionId,
              userId,
              actualSets,
              auxiliarySets,
              sessionRpe,
              startedAt,
            } = op.payload;

            await completeSession(sessionId, userId, {
              actualSets,
              auxiliarySets,
              sessionRpe,
              startedAt: startedAt ? new Date(startedAt) : undefined,
            });

            dequeue(op.id);
            syncedCount++;

            await queryClient.invalidateQueries({
              queryKey: sessionQueries.all(),
            });
            // Prefix keys — can't import module queries (circular: session → achievements → session)
            await queryClient.invalidateQueries({
              queryKey: ['performance'],
            });
            await queryClient.invalidateQueries({
              queryKey: ['achievements'],
            });

            // Stamp cycle phase — was skipped when the session was queued offline.
            stampCyclePhaseOnSession(userId, sessionId).catch(captureException);

            // Fire-and-forget: run achievement detection now that data is on the server.
            // Dynamic import breaks the session ↔ achievements circular dependency.
            import('@modules/achievements')
              .then(({ detectAchievements }) =>
                detectAchievements(sessionId, userId, actualSets)
              )
              .catch(captureException);
          } else if (op.operation === 'upsert_set_log') {
            await upsertSetLog({
              sessionId: op.payload.sessionId,
              userId: op.payload.userId,
              kind: op.payload.kind,
              exercise: op.payload.exercise,
              setNumber: op.payload.setNumber,
              weightGrams: op.payload.weightGrams,
              repsCompleted: op.payload.repsCompleted,
              rpeActual: op.payload.rpeActual,
              actualRestSeconds: op.payload.actualRestSeconds,
              exerciseType: op.payload.exerciseType,
              failed: op.payload.failed,
              notes: op.payload.notes,
              loggedAt: op.payload.loggedAt,
            });
            dequeue(op.id);
            // Mirror success onto local state so the persistence subscriber
            // stops considering this set dirty.
            const storeState = useSessionStore.getState();
            if (storeState.sessionId === op.payload.sessionId) {
              if (op.payload.kind === 'primary') {
                storeState.markSetSynced(
                  op.payload.setNumber,
                  op.payload.loggedAt
                );
              } else if (op.payload.exercise) {
                storeState.markAuxSetSynced(
                  op.payload.exercise,
                  op.payload.setNumber,
                  op.payload.loggedAt
                );
              }
            }
          }
        } catch (err) {
          if (isNetworkError(err)) {
            incrementRetry(op.id);
          } else {
            captureException(err);
            dequeue(op.id);
            // Only alert for full-session failures; per-set drains are
            // backstopped by the completeSession batch write.
            if (op.operation !== 'upsert_set_log') {
              Alert.alert(
                'Sync Failed',
                'Your workout could not be saved. The error has been reported.'
              );
            }
          }
        }
      }

      if (syncedCount > 0) {
        Alert.alert(
          'Workouts Synced',
          syncedCount === 1
            ? 'Your workout has been saved successfully.'
            : `${syncedCount} workouts have been saved successfully.`
        );
      }
    } finally {
      processingRef.current = false;
    }
  }
}
