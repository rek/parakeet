import { router } from 'expo-router'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { BlockBadge } from './BlockBadge'
import { colors, spacing, radii, typography } from '../../theme'
import type { ProgramSession } from '@modules/program'
import { formatDate } from '@shared/utils/date'

interface SessionSummaryProps {
  session: ProgramSession
}

const STATUS_DOT_COLOR: Record<string, string> = {
  planned:     colors.textTertiary,
  in_progress: colors.info,
  completed:   colors.success,
  skipped:     colors.danger,
}

function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function SessionSummary({ session }: SessionSummaryProps) {
  const dotColor = STATUS_DOT_COLOR[session.status] ?? colors.textTertiary
  const isActionable = session.status === 'planned' || session.status === 'in_progress'

  function handlePress() {
    if (!isActionable) return
    router.push({
      pathname: '/session/soreness',
      params: { sessionId: session.id },
    })
  }

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={handlePress}
      activeOpacity={isActionable ? 0.7 : 1}
    >
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />

      <View style={styles.middle}>
        <Text style={styles.liftText}>
          {capitalize(session.primary_lift)} — {session.intensity_type}
        </Text>
        <Text style={styles.dateText}>
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
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    marginRight: spacing[3],
  },
  middle: {
    flex: 1,
  },
  liftText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing[0.5],
  },
  dateText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
})
