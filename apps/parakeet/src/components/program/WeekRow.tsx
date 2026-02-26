import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { BlockBadge } from './BlockBadge'
import { SessionSummary } from './SessionSummary'
import { colors, spacing, radii, typography } from '../../theme'

interface WeekSession {
  id: string
  day_number: number
  primary_lift: string
  intensity_type: string
  planned_date: string
  status: string
  block_number: number | null
  week_number: number
}

interface WeekRowProps {
  weekNumber: number
  sessions: WeekSession[]
  isCurrentWeek: boolean
}

export function WeekRow({ weekNumber, sessions, isCurrentWeek }: WeekRowProps) {
  const [expanded, setExpanded] = useState(isCurrentWeek)

  const completedCount = sessions.filter((s) => s.status === 'completed').length
  const totalCount = sessions.length
  const firstBlockNumber = sessions[0]?.block_number ?? null

  return (
    <View style={[styles.container, isCurrentWeek && styles.containerCurrent]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((prev) => !prev)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Text style={[styles.weekLabel, isCurrentWeek && styles.weekLabelCurrent]}>
            Week {weekNumber}
            {isCurrentWeek ? (
              <Text style={styles.currentBadge}> · Now</Text>
            ) : null}
          </Text>
          <Text style={styles.fraction}>
            {completedCount}/{totalCount}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <BlockBadge block={firstBlockNumber} />
          <Text style={styles.chevron}>{expanded ? '▼' : '▶'}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.sessionList}>
          {sessions.map((session) => (
            <SessionSummary session={session} key={session.id} />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
    overflow: 'hidden',
  },
  containerCurrent: {
    borderColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
  },
  weekLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  weekLabelCurrent: {
    color: colors.primary,
  },
  currentBadge: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary,
  },
  fraction: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  sessionList: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[1],
  },
})
