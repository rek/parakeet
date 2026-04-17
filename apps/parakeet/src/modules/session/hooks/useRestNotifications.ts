import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { getRestTimerPrefs } from '@modules/settings';
import {
  cancelRestNotification,
  scheduleRestNotification,
} from '@platform/lib/rest-notifications';
import { useSessionStore } from '@platform/store/sessionStore';
import { captureException } from '@platform/utils/captureException';

export function useRestNotifications(): void {
  const pendingNotifIdRef = useRef<string | null>(null);
  const prefEnabledRef = useRef(false);

  useEffect(() => {
    getRestTimerPrefs().then((p) => {
      prefEnabledRef.current = p.backgroundRestNotification;
    });
  }, []);

  useEffect(() => {
    const hasTimers = Object.keys(useSessionStore.getState().timers).length > 0;
    if (!hasTimers && pendingNotifIdRef.current) {
      cancelRestNotification(pendingNotifIdRef.current);
      pendingNotifIdRef.current = null;
    }
  });

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        if (!prefEnabledRef.current) return;

        const store = useSessionStore.getState();
        const meta = store.sessionMeta;
        if (!meta) return;

        // Find soonest-expiring timer
        let soonestRemaining = Infinity;
        for (const ts of Object.values(store.timers)) {
          const elapsed =
            ts.timerStartedAt != null
              ? Math.floor((Date.now() - ts.timerStartedAt) / 1000)
              : ts.elapsed;
          const remaining = ts.durationSeconds + ts.offset - elapsed;
          if (remaining > 0 && remaining < soonestRemaining) {
            soonestRemaining = remaining;
          }
        }

        if (soonestRemaining === Infinity) return;

        scheduleRestNotification({
          lift: meta.primary_lift!,
          intensityType: meta.intensity_type!,
          delaySeconds: soonestRemaining,
          sessionId: store.sessionId,
        })
          .then((id) => {
            pendingNotifIdRef.current = id;
          })
          .catch((err) => captureException(err));
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
