import { router } from 'expo-router'
import {
  Alert,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { WeekRow } from '../../components/program/WeekRow'
import { useActiveProgram } from '../../hooks/useActiveProgram'
import { useAuth } from '../../hooks/useAuth'
import { updateProgramStatus } from '../../lib/programs'
import { qk } from '../../queries/keys'
import { colors, spacing, typography } from '../../theme'
import { groupByWeek, determineCurrentWeek } from '../../utils/program-utils'
import type { ProgramSession } from '../../utils/program-utils'

export default function ProgramScreen() {
  const { data: program, isLoading } = useActiveProgram()
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()

  const abandon = useMutation({
    mutationFn: (programId: string) => updateProgramStatus(programId, 'archived'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.program.active(user?.id) }),
  })

  function confirmAbandon() {
    if (!program) return
    Alert.alert(
      'Abandon Program',
      'This will archive your current program. You can start a new one anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Abandon',
          style: 'destructive',
          onPress: () => abandon.mutate(program.id),
        },
      ],
    )
  }

  if (isLoading || authLoading) {
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
        <View style={styles.headerRow}>
          <Text style={styles.title}>My Program</Text>
          <TouchableOpacity onPress={confirmAbandon} disabled={abandon.isPending}>
            <Text style={styles.abandonText}>Abandon</Text>
          </TouchableOpacity>
        </View>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  abandonText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
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
