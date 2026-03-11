import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { getRestTimerPrefs } from '@modules/settings/lib/settings';
import {
  cancelRestNotification,
  scheduleRestNotification,
} from '@platform/lib/rest-notifications';
import { useSessionStore } from '@platform/store/sessionStore';

export function useRestNotifications(): void {
  const pendingNotifIdRef = useRef<string | null>(null);
  const prefEnabledRef = useRef(false);

  useEffect(() => {
    getRestTimerPrefs().then((p) => {
      prefEnabledRef.current = p.backgroundRestNotification;
    });
  }, []);

  useEffect(() => {
    const timerVisible = useSessionStore.getState().timerState?.visible;
    if (!timerVisible && pendingNotifIdRef.current) {
      cancelRestNotification(pendingNotifIdRef.current);
      pendingNotifIdRef.current = null;
    }
  });

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        if (!prefEnabledRef.current) return;

        const store = useSessionStore.getState();
        const ts = store.timerState;
        const meta = store.sessionMeta;

        if (!ts?.visible || !meta) return;

        const elapsed =
          ts.timerStartedAt != null
            ? Math.floor((Date.now() - ts.timerStartedAt) / 1000)
            : ts.elapsed;
        const remaining = ts.durationSeconds + ts.offset - elapsed;

        if (remaining <= 0) return;

        scheduleRestNotification(
          meta.primary_lift!,
          meta.intensity_type!,
          remaining
        )
          .then((id) => {
            pendingNotifIdRef.current = id;
          })
          .catch(() => {});
      } else if (nextState === 'active') {
        if (pendingNotifIdRef.current) {
          cancelRestNotification(pendingNotifIdRef.current);
          pendingNotifIdRef.current = null;
        }
      }
    });

    return () => sub.remove();
  }, []);
}
