import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getSession, getSessionLog } from '@modules/session'
import { BackLink } from '../../components/navigation/BackLink'
import { colors, radii, spacing, typography } from '../../theme'
import { formatDate, formatTime } from '@shared/utils/date'
import { capitalize } from '@shared/utils/string'
import type { Lift } from '@parakeet/shared-types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function gramsToKg(grams: number): string {
  return (grams / 1000).toFixed(1)
}

const LIFT_LABELS: Record<Lift, string> = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
}

const PERFORMANCE_LABELS: Record<string, string> = {
  over: 'Above plan',
  at: 'On plan',
  under: 'Below plan',
  incomplete: 'Incomplete',
}

const PERFORMANCE_COLORS: Record<string, string> = {
  over: colors.success,
  at: colors.success,
  under: colors.warning,
  incomplete: colors.danger,
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['session', 'detail', sessionId],
    queryFn: () => getSession(sessionId),
    enabled: !!sessionId,
  })

  const { data: log, isLoading: logLoading } = useQuery({
    queryKey: ['session', 'log', sessionId],
    queryFn: () => getSessionLog(sessionId),
    enabled: !!sessionId,
  })

  const isLoading = sessionLoading || logLoading

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <BackLink onPress={() => router.back()} />
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>Session not found.</Text>
        </View>
      </SafeAreaView>
    )
  }

  const liftLabel = LIFT_LABELS[session.primary_lift as Lift] ?? capitalize(session.primary_lift)
  const intensityLabel = capitalize(session.intensity_type)
  const completedAt = session.completed_at ?? null
  const dateLabel = formatDate(completedAt ?? session.planned_date)
  const timeLabel = completedAt ? formatTime(completedAt) : ''

  const mainSets = log?.actual_sets ?? []
  const auxSets = log?.auxiliary_sets ?? []

  // Group auxiliary sets by exercise name
  const auxByExercise = auxSets.reduce<Record<string, typeof auxSets>>((acc, set) => {
    const name = set.exercise ?? 'Auxiliary'
    if (!acc[name]) acc[name] = []
    acc[name].push(set)
    return acc
  }, {})

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <BackLink onPress={() => router.back()} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.title}>{liftLabel} — {intensityLabel}</Text>
        <Text style={styles.subtitle}>
          Week {session.week_number}{session.block_number ? ` · Block ${session.block_number}` : ''} · {dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}
        </Text>

        {/* Summary row */}
        {log && (
          <View style={styles.summaryRow}>
            {log.session_rpe != null && (
              <View style={styles.summaryChip}>
                <Text style={styles.summaryChipLabel}>RPE</Text>
                <Text style={styles.summaryChipValue}>{log.session_rpe}</Text>
              </View>
            )}
            {log.completion_pct != null && (
              <View style={styles.summaryChip}>
                <Text style={styles.summaryChipLabel}>Completion</Text>
                <Text style={styles.summaryChipValue}>{Math.round(log.completion_pct)}%</Text>
              </View>
            )}
            {log.performance_vs_plan && (
              <View style={styles.summaryChip}>
                <Text style={styles.summaryChipLabel}>vs Plan</Text>
                <Text style={[
                  styles.summaryChipValue,
                  { color: PERFORMANCE_COLORS[log.performance_vs_plan] ?? colors.text }
                ]}>
                  {PERFORMANCE_LABELS[log.performance_vs_plan] ?? log.performance_vs_plan}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Main lift sets */}
        {mainSets.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Main Lift</Text>
            <View style={styles.setsTable}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.tableCellSet]}>Set</Text>
                <Text style={[styles.tableCell, styles.tableCellWeight]}>Weight</Text>
                <Text style={[styles.tableCell, styles.tableCellReps]}>Reps</Text>
                <Text style={[styles.tableCell, styles.tableCellRpe]}>RPE</Text>
              </View>
              {mainSets.map((set, i) => (
                <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                  <Text style={[styles.tableCell, styles.tableCellSet]}>{set.set_number}</Text>
                  <Text style={[styles.tableCell, styles.tableCellWeight]}>{gramsToKg(set.weight_grams)} kg</Text>
                  <Text style={[styles.tableCell, styles.tableCellReps]}>{set.reps_completed}</Text>
                  <Text style={[styles.tableCell, styles.tableCellRpe]}>
                    {set.rpe_actual != null ? set.rpe_actual : '—'}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Auxiliary sets */}
        {Object.entries(auxByExercise).map(([exercise, sets]) => (
          <View key={exercise}>
            <Text style={styles.sectionHeader}>{capitalize(exercise.replace(/_/g, ' '))}</Text>
            <View style={styles.setsTable}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.tableCellSet]}>Set</Text>
                <Text style={[styles.tableCell, styles.tableCellWeight]}>Weight</Text>
                <Text style={[styles.tableCell, styles.tableCellReps]}>Reps</Text>
                <Text style={[styles.tableCell, styles.tableCellRpe]}>RPE</Text>
              </View>
              {sets.map((set, i) => (
                <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                  <Text style={[styles.tableCell, styles.tableCellSet]}>{set.set_number}</Text>
                  <Text style={[styles.tableCell, styles.tableCellWeight]}>{gramsToKg(set.weight_grams)} kg</Text>
                  <Text style={[styles.tableCell, styles.tableCellReps]}>{set.reps_completed}</Text>
                  <Text style={[styles.tableCell, styles.tableCellRpe]}>
                    {set.rpe_actual != null ? set.rpe_actual : '—'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {!log && (
          <Text style={styles.emptyText}>No set data recorded for this session.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing[4], paddingTop: spacing[2] },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
    marginBottom: spacing[5],
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[6],
    flexWrap: 'wrap',
  },
  summaryChip: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2.5],
    alignItems: 'center',
    minWidth: 80,
  },
  summaryChipLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
    fontWeight: typography.weights.medium,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing[0.5],
  },
  summaryChipValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  sectionHeader: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
    marginBottom: spacing[2],
    marginTop: spacing[2],
  },
  setsTable: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing[5],
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.bgMuted,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3],
  },
  tableRowAlt: { backgroundColor: colors.bgMuted + '55' },
  tableCell: {
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  tableCellSet: { width: 36, color: colors.textSecondary },
  tableCellWeight: { flex: 1 },
  tableCellReps: { width: 48, textAlign: 'center' },
  tableCellRpe: { width: 48, textAlign: 'right', color: colors.textSecondary },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing[8],
  },
})
