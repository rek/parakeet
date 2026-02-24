import { router } from 'expo-router'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { BlockBadge } from './BlockBadge'

interface SessionSummaryProps {
  session: {
    id: string
    day_number: number
    primary_lift: string
    intensity_type: string
    planned_date: string
    status: string
    block_number: number | null
    week_number: number
  }
}

const STATUS_DOT_COLOR: Record<string, string> = {
  planned:     '#9CA3AF',
  in_progress: '#3B82F6',
  completed:   '#10B981',
  skipped:     '#EF4444',
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-AU', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function SessionSummary({ session }: SessionSummaryProps) {
  const dotColor = STATUS_DOT_COLOR[session.status] ?? '#9CA3AF'
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
        <Text style={styles.dateText}>{formatDate(session.planned_date)}</Text>
      </View>

      <BlockBadge block={session.block_number} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  middle: {
    flex: 1,
  },
  liftText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 13,
    color: '#6B7280',
  },
})
