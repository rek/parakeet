// useMissedSessionReconciliation.ts
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@modules/auth/hooks/useAuth';
import { qk } from '@platform/query';
import { captureException } from '@platform/utils/captureException';
import { markMissedSessions } from '../application/session.service';

export function useMissedSessionReconciliation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);

  const reconcile = useCallback(async () => {
    if (!user?.id || inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      await markMissedSessions(user.id);
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      await queryClient.invalidateQueries({
        queryKey: qk.session.today(user.id),
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
