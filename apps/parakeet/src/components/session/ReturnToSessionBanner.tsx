import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import { router, usePathname } from 'expo-router'
import * as Haptics from 'expo-haptics'

import { useSessionStore } from '@platform/store/sessionStore'
import { getRestTimerPrefs } from '@modules/settings'
import { detectOvertimeEdge, useRestNotifications } from '@modules/session'
import { formatMMSS } from '../../shared/utils'
import { colors, radii, spacing, typography } from '../../theme'

function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function ReturnToSessionBanner() {
  useRestNotifications()

  const sessionId = useSessionStore((s) => s.sessionId)
  const sessionMeta = useSessionStore((s) => s.sessionMeta)
  const cachedJitData = useSessionStore((s) => s.cachedJitData)
  const timerState = useSessionStore((s) => s.timerState)

  const pathname = usePathname()

  // Edge-detector ref: resets whenever a new timer starts or closes
  const prevOvertimeRef = useRef(false)
  const hapticAlertRef = useRef(true)  // matches RestTimerPrefs default

  // Load haptic preference once
  useEffect(() => {
    getRestTimerPrefs().then((p) => { hapticAlertRef.current = p.hapticAlert })
  }, [])

  // Reset edge detector when the timer changes (new rest interval or closes)
  useEffect(() => {
    prevOvertimeRef.current = false
  }, [timerState?.visible, timerState?.durationSeconds])

  // Local tick to force re-render every second for live countdown
  // Also checks for haptic trigger via getState() to avoid stale closure
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!timerState?.visible) return
    const id = setInterval(() => {
      setTick((n) => n + 1)

      // Read fresh timerState to avoid stale closure
      const ts = useSessionStore.getState().timerState
      if (!ts?.visible) return

      const elapsed = ts.timerStartedAt != null
        ? Math.floor((Date.now() - ts.timerStartedAt) / 1000)
        : ts.elapsed
      const remaining = ts.durationSeconds + ts.offset - elapsed

      if (detectOvertimeEdge(prevOvertimeRef.current, remaining) && hapticAlertRef.current) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
      }
      prevOvertimeRef.current = remaining <= 0
    }, 1000)
    return () => clearInterval(id)
  }, [timerState?.visible])

  if (!sessionId) return null
  if (pathname.startsWith('/session')) return null

  const timerActive = timerState?.visible === true

  const liftLabel = sessionMeta
    ? `${capitalize(sessionMeta.primary_lift)} — ${capitalize(sessionMeta.intensity_type)}`
    : 'Session'

  const blockLabel = sessionMeta
    ? sessionMeta.block_number !== null
      ? `Block ${sessionMeta.block_number} · Week ${sessionMeta.week_number}`
      : `Week ${sessionMeta.week_number}`
    : ''

  let restLabel = 'In progress →'
  let overtime = false
  if (timerActive && timerState) {
    const elapsed = timerState.timerStartedAt != null
      ? Math.floor((Date.now() - timerState.timerStartedAt) / 1000)
      : timerState.elapsed
    const remaining = timerState.durationSeconds + timerState.offset - elapsed
    overtime = remaining <= 0
    restLabel = overtime ? 'Rest done' : `Rest: ${formatMMSS(remaining)}`
  }

  function handlePress() {
    router.push({
      pathname: '/session/[sessionId]',
      params: { sessionId: sessionId!, jitData: cachedJitData ?? '', openHistory: '1' },
    })
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={[styles.pill, overtime && styles.pillOvertime]}
    >
      <Text style={styles.label} numberOfLines={1}>
        {liftLabel}{blockLabel ? `  ·  ${blockLabel}` : ''}
      </Text>
      <Text style={[styles.rest, overtime && styles.restOvertime]}>
        {restLabel}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  pillOvertime: {
    backgroundColor: colors.warning,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textInverse,
    flexShrink: 1,
  },
  rest: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },
  restOvertime: {
    color: colors.textInverse,
  },
})
