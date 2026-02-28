import { useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity,  } from 'react-native'
import { router, usePathname } from 'expo-router'
import { useSessionStore } from '../../store/sessionStore'
import { colors, radii, spacing, typography } from '../../theme'

function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function ReturnToSessionBanner() {
  const sessionId = useSessionStore((s) => s.sessionId)
  const sessionMeta = useSessionStore((s) => s.sessionMeta)
  const cachedJitData = useSessionStore((s) => s.cachedJitData)
  const timerState = useSessionStore((s) => s.timerState)

  const pathname = usePathname()

  // Local tick to force re-render every second for live countdown
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!timerState?.visible) return
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [timerState?.visible])

  if (!sessionId) return null
  if (pathname.startsWith('/session')) return null
  if (timerState?.visible !== true) return null

  const elapsed = timerState.timerStartedAt != null
    ? Math.floor((Date.now() - timerState.timerStartedAt) / 1000)
    : timerState.elapsed

  const effectiveDuration = timerState.durationSeconds + timerState.offset
  const remaining = effectiveDuration - elapsed
  const overtime = remaining <= 0

  const liftLabel = sessionMeta
    ? `${capitalize(sessionMeta.primary_lift)} — ${capitalize(sessionMeta.intensity_type)}`
    : 'Session'

  const blockLabel = sessionMeta
    ? sessionMeta.block_number !== null
      ? `Block ${sessionMeta.block_number} · Week ${sessionMeta.week_number}`
      : `Week ${sessionMeta.week_number}`
    : ''

  const restLabel = overtime ? 'Rest done' : `Rest: ${formatMMSS(remaining)}`

  function handlePress() {
    router.push({
      pathname: '/session/[sessionId]',
      params: { sessionId: sessionId!, jitData: cachedJitData ?? '' },
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
