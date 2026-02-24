import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'

import { getProgram } from '../../../lib/programs'

// ── Helpers ──────────────────────────────────────────────────────────────────

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatSessionDate(dateStr: string): string {
  // dateStr is ISO date: "2025-02-24"
  // Parse as local date to avoid UTC midnight-to-previous-day shift
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return `${WEEKDAY_SHORT[d.getDay()]} ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`
}

function capitalize(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Session {
  id: string
  week_number: number
  day_number: number
  primary_lift: string
  intensity_type: string
  block_number: number
  is_deload: boolean
  planned_date: string
  status: string
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function ReviewScreen() {
  const { programId } = useLocalSearchParams<{ programId: string }>()

  const { data: program, isPending, isError } = useQuery({
    queryKey: ['program', programId],
    queryFn: () => getProgram(programId),
    enabled: !!programId,
  })

  if (isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    )
  }

  if (isError || !program) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load program. Please try again.</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const week1Sessions: Session[] = ((program.sessions ?? []) as Session[])
    .filter((s) => s.week_number === 1)
    .sort((a, b) => a.day_number - b.day_number)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Program</Text>
        <Text style={styles.subtitle}>
          {program.total_weeks}-week program · {program.training_days_per_week} days/week
        </Text>
      </View>

      <Text style={styles.weekLabel}>Week 1 Preview</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sessionsRow}
        style={styles.sessionsScroll}
      >
        {week1Sessions.map((session) => (
          <View key={session.id} style={styles.sessionCard}>
            <Text style={styles.cardLift}>
              {capitalize(session.primary_lift)}
            </Text>
            <Text style={styles.cardIntensity}>{session.intensity_type}</Text>
            <View style={styles.cardDivider} />
            <Text style={styles.cardDate}>{formatSessionDate(session.planned_date)}</Text>
            <Text style={styles.cardBlock}>Block {session.block_number}</Text>
            <Text style={styles.cardNote}>Sets generated before workout</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.replace('/(tabs)/today')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Start Training</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.editLink}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.editLinkText}>Edit Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  backLink: {
    marginTop: 8,
  },
  backLinkText: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
  },
  weekLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  sessionsScroll: {
    flexGrow: 0,
  },
  sessionsRow: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  sessionCard: {
    width: 200,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
  },
  cardLift: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  cardIntensity: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginBottom: 12,
  },
  cardDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  cardBlock: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
  },
  cardNote: {
    fontSize: 11,
    color: '#d1d5db',
    fontStyle: 'italic',
    lineHeight: 15,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  editLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  editLinkText: {
    fontSize: 14,
    color: '#6b7280',
    textDecorationLine: 'underline',
  },
})
