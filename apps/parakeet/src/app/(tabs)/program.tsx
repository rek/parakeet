import { router } from 'expo-router'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { WeekRow } from '../../components/program/WeekRow'
import { useActiveProgram } from '../../hooks/useActiveProgram'
import { colors, spacing, typography } from '../../theme'

interface ProgramSession {
  id: string
  day_number: number
  primary_lift: string
  intensity_type: string
  planned_date: string
  status: string
  block_number: number | null
  week_number: number
}

function groupByWeek(sessions: ProgramSession[]): [number, ProgramSession[]][] {
  const map = new Map<number, ProgramSession[]>()
  for (const s of sessions) {
    if (!map.has(s.week_number)) map.set(s.week_number, [])
    map.get(s.week_number)!.push(s)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a - b)
}

function determineCurrentWeek(sessions: ProgramSession[]): number {
  const activeSession = sessions.find(
    (s) => s.status === 'planned' || s.status === 'in_progress',
  )
  return activeSession?.week_number ?? 1
}

export default function ProgramScreen() {
  const { data: program, isLoading } = useActiveProgram()

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    )
  }

  if (!program) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Program</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No active program</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/onboarding/lift-maxes')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Create Program</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const sessions: ProgramSession[] = (program.sessions ?? []) as ProgramSession[]
  const weekGroups = groupByWeek(sessions)
  const currentWeek = determineCurrentWeek(sessions)

  const currentWeekSessions = sessions.filter((s) => s.week_number === currentWeek)
  const currentBlock = currentWeekSessions[0]?.block_number ?? 1

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Program</Text>
        <Text style={styles.subtitle}>
          Block {currentBlock} of 3 · Week {currentWeek} of {program.total_weeks}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {weekGroups.map(([weekNumber, weekSessions]) => (
          <WeekRow
            key={weekNumber}
            weekNumber={weekNumber}
            sessions={weekSessions}
            isCurrentWeek={weekNumber === currentWeek}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[5],
  },
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.black,
    color: colors.text,
    marginBottom: spacing[1],
    letterSpacing: typography.letterSpacing.tight,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing[8],
  },
  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing[6],
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
    letterSpacing: typography.letterSpacing.wide,
  },
})
