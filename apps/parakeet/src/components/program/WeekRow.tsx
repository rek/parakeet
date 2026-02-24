import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { BlockBadge } from './BlockBadge'
import { SessionSummary } from './SessionSummary'

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
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((prev) => !prev)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.weekLabel}>
            Week {weekNumber}
            {isCurrentWeek ? (
              <Text style={styles.currentBadge}> (Current)</Text>
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
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weekLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  currentBadge: {
    fontSize: 13,
    fontWeight: '500',
    color: '#10B981',
  },
  fraction: {
    fontSize: 13,
    color: '#6B7280',
  },
  chevron: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  sessionList: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
})
