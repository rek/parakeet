// @spec docs/features/session/spec-missed.md
// useMissedSessionReconciliation.ts
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@modules/auth';
import { captureException } from '@platform/utils/captureException';
import { useQueryClient } from '@tanstack/react-query';

import {
  abandonStaleInProgressSessions,
  markMissedSessions,
} from '../application/session.service';
import { sessionQueries } from '../data/session.queries';

export function useMissedSessionReconciliation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);

  const reconcile = useCallback(async () => {
    if (!user?.id || inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      await abandonStaleInProgressSessions(user.id);
      await markMissedSessions(user.id);
      await queryClient.invalidateQueries({
        queryKey: sessionQueries.all(),
      });
    } catch (err) {
      captureException(err);
    } finally {
      inFlightRef.current = false;
    }
  }, [queryClient, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    void reconcile();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void reconcile();
      }
    });

    return () => {
      sub.remove();
    };
  }, [reconcile, user?.id]);
}
