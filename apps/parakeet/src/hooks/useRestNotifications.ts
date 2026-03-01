import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'

import { useSessionStore } from '../store/sessionStore'
import { getRestTimerPrefs } from '../lib/settings'
import { scheduleRestNotification, cancelRestNotification } from '../lib/rest-notifications'

/**
 * Handles scheduling and cancellation of background "rest done" local
 * notifications. Mount once in a globally rendered component (e.g. the
 * ReturnToSessionBanner which is always in the layout).
 *
 * Behaviour:
 * - When the app moves to background with an active rest timer:
 *   schedules a notification for the remaining rest time.
 * - When the app returns to foreground: cancels the pending notification.
 * - When the timer closes (no longer visible): cancels pending notification.
 */
export function useRestNotifications(): void {
  const pendingNotifIdRef = useRef<string | null>(null)
  const prefEnabledRef = useRef(false)

  // Load pref on mount
  useEffect(() => {
    getRestTimerPrefs().then((p) => {
      prefEnabledRef.current = p.backgroundRestNotification
    })
  }, [])

  // Cancel pending notification when timer closes
  useEffect(() => {
    const timerVisible = useSessionStore.getState().timerState?.visible
    if (!timerVisible && pendingNotifIdRef.current) {
      cancelRestNotification(pendingNotifIdRef.current)
      pendingNotifIdRef.current = null
    }
  })

  // Subscribe to AppState changes for background/foreground transitions
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        // Schedule notification if timer is running and pref is enabled
        if (!prefEnabledRef.current) return

        const store = useSessionStore.getState()
        const ts = store.timerState
        const meta = store.sessionMeta

        if (!ts?.visible || !meta) return

        const elapsed = ts.timerStartedAt != null
          ? Math.floor((Date.now() - ts.timerStartedAt) / 1000)
          : ts.elapsed
        const remaining = ts.durationSeconds + ts.offset - elapsed

        if (remaining <= 0) return  // already expired, skip

        scheduleRestNotification(meta.primary_lift, meta.intensity_type, remaining)
          .then((id) => { pendingNotifIdRef.current = id })
          .catch(() => {})

      } else if (nextState === 'active') {
        // Cancel on return to foreground
        if (pendingNotifIdRef.current) {
          cancelRestNotification(pendingNotifIdRef.current)
          pendingNotifIdRef.current = null
        }
      }
    })

    return () => sub.remove()
  }, [])
}
