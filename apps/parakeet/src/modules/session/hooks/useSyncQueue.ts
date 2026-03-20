import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { useNetworkStatus } from '@platform/network/useNetworkStatus';
import { useSyncStore } from '@platform/store/syncStore';
import { captureException } from '@platform/utils/captureException';
import { useQueryClient } from '@tanstack/react-query';

import { completeSession } from '../application/session.service';
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
          Alert.alert(
            'Sync Failed',
            'Your workout data could not be saved after multiple attempts. Please check your connection and try again.'
          );
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

            await queryClient.invalidateQueries({ queryKey: ['session'] });
            await queryClient.invalidateQueries({
              queryKey: ['sessions', 'completed'],
            });
            await queryClient.invalidateQueries({
              queryKey: ['performance', 'trends'],
            });
            await queryClient.invalidateQueries({ queryKey: ['achievements'] });
          }
        } catch (err) {
          if (isNetworkError(err)) {
            incrementRetry(op.id);
          } else {
            captureException(err);
            dequeue(op.id);
            Alert.alert(
              'Sync Failed',
              `Workout could not be saved: ${err instanceof Error ? err.message : 'Unknown error'}`
            );
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
