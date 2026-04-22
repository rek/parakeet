// @spec docs/features/rest-timer/spec-notification.md
import { useEffect } from 'react';

import { useSessionStore } from '@platform/store/sessionStore';
import { captureException } from '@platform/utils/captureException';
import { router } from 'expo-router';

/**
 * Listens for notification response events (user taps) and routes back to the
 * active session when a `rest_done` notification is tapped.
 *
 * A stale notification (timer no longer active or sessionId mismatch) is
 * silently ignored rather than navigating to a stale screen.
 *
 * Mount once at the root layout alongside `useRestNotifications`.
 */
export function useRestNotificationTapHandler(): void {
  useEffect(() => {
    let sub: { remove: () => void } | null = null;

    const setup = async () => {
      try {
        const Notifications = await import('expo-notifications');

        sub = Notifications.addNotificationResponseReceivedListener(
          (response) => {
            const data = response.notification.request.content.data as Record<
              string,
              unknown
            >;

            if (data?.type !== 'rest_done') return;

            const notifSessionId =
              typeof data.sessionId === 'string' ? data.sessionId : null;

            const store = useSessionStore.getState();
            const activeSessionId = store.sessionId;
            const timerActive = Object.keys(store.timers).length > 0;

            // Ignore stale notification: session closed or no longer the same session
            if (
              !activeSessionId ||
              (notifSessionId && notifSessionId !== activeSessionId)
            ) {
              return;
            }

            // Timer already dismissed — rest is done, but user is already back
            if (!timerActive) {
              return;
            }

            router.push({
              pathname: '/session/[sessionId]',
              params: {
                sessionId: activeSessionId,
                jitData: store.cachedJitData ?? '',
              },
            });
          }
        );
      } catch (err) {
        captureException(err);
      }
    };

    setup();

    return () => {
      sub?.remove();
    };
  }, []);
}
