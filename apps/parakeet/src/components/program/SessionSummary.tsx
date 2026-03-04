import { router } from 'expo-router'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { BlockBadge } from './BlockBadge'
import { colors, spacing, radii, typography } from '../../theme'
import type { ProgramSession } from '@modules/program'
import { useInProgressSession } from '@modules/session'
import { getReadyCachedJitData } from '@platform/store/sessionStore'
import { formatDate } from '@shared/utils/date'

interface SessionSummaryProps {
  session: ProgramSession
}

function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function SessionSummary({ session }: SessionSummaryProps) {
  const { data: activeSession } = useInProgressSession()

  const isInProgress = session.status === 'in_progress'
  const isLocked =
    session.status === 'planned' &&
    !!activeSession &&
    activeSession.id !== session.id

  const isActionable = (isInProgress || session.status === 'planned') && !isLocked

  async function handlePress() {
    if (!isActionable) return
    if (isInProgress) {
      const jit = await getReadyCachedJitData()
      if (!jit) return
      router.push({
        pathname: '/session/[sessionId]',
        params: { sessionId: session.id, jitData: jit },
      })
      return
    }
    router.push({
      pathname: '/session/soreness',
      params: { sessionId: session.id },
    })
  }

  const dotColor = isInProgress
    ? colors.primary
    : isLocked
      ? colors.textTertiary
      : {
          planned:   colors.textTertiary,
          completed: colors.success,
          skipped:   colors.danger,
          missed:    colors.danger,
        }[session.status] ?? colors.textTertiary

  return (
    <TouchableOpacity
      style={[styles.row, isLocked && styles.rowLocked]}
      onPress={handlePress}
      activeOpacity={isActionable ? 0.7 : 1}
    >
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />

      <View style={styles.middle}>
        <View style={styles.liftRow}>
          <Text style={[styles.liftText, isLocked && styles.liftTextLocked]}>
            {capitalize(session.primary_lift)} — {session.intensity_type}
          </Text>
          {isInProgress && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          )}
          {isLocked && (
            <Text style={styles.lockIcon}>🔒</Text>
          )}
        </View>
        <Text style={[styles.dateText, isLocked && styles.dateTextLocked]}>
          {session.completed_at ? formatDate(session.completed_at) : formatDate(session.planned_date)}
        </Text>
      </View>

      <BlockBadge block={session.block_number} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2.5],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  rowLocked: {
    opacity: 0.45,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    marginRight: spacing[3],
  },
  middle: {
    flex: 1,
  },
  liftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[0.5],
  },
  liftText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  liftTextLocked: {
    color: colors.textSecondary,
  },
  activeBadge: {
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  activeBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
    letterSpacing: typography.letterSpacing.wide,
  },
  lockIcon: {
    fontSize: 11,
  },
  dateText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  dateTextLocked: {
    color: colors.textTertiary,
  },
})
