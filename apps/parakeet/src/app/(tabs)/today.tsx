import { router } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { WorkoutCard } from '../../components/training/WorkoutCard'
import { StreakPill } from '../../components/achievements/StreakPill'
import { useAuth } from '../../hooks/useAuth'
import { useActiveProgram } from '../../hooks/useActiveProgram'
import { useTodaySession } from '../../hooks/useTodaySession'
import { useWeeklyVolume } from '../../hooks/useWeeklyVolume'
import { useCyclePhase } from '../../hooks/useCyclePhase'
import { getActiveDisruptions } from '../../lib/disruptions'
import { getStreakData } from '../../lib/achievements'
import { colors, palette, spacing, radii, typography } from '../../theme'
import type { MuscleGroup, VolumeStatus } from '@parakeet/training-engine'

// ── Cycle phase constants ─────────────────────────────────────────────────────

const CYCLE_PHASE_BG: Record<string, string> = {
  menstrual:   palette.red100,
  follicular:  palette.emerald100,
  ovulatory:   palette.amber100,
  luteal:      palette.indigo100,
  late_luteal: palette.indigo100,
}
const CYCLE_PHASE_TEXT: Record<string, string> = {
  menstrual:   palette.red800,
  follicular:  palette.emerald800,
  ovulatory:   palette.amber800,
  luteal:      palette.indigo800,
  late_luteal: palette.indigo800,
}

const CYCLE_PHASE_LABELS: Record<string, string> = {
  menstrual:   'Menstrual',
  follicular:  'Follicular',
  ovulatory:   'Ovulatory',
  luteal:      'Luteal',
  late_luteal: 'Late Luteal',
}

// ── Volume compact card ───────────────────────────────────────────────────────

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  quads:      'Quads',
  hamstrings: 'Hams',
  glutes:     'Glutes',
  lower_back: 'Lower Back',
  upper_back: 'Upper Back',
  chest:      'Chest',
  triceps:    'Triceps',
  shoulders:  'Shoulders',
  biceps:     'Biceps',
}

const BAR_COLORS: Record<VolumeStatus, string> = {
  below_mev:       colors.warning,
  in_range:        colors.success,
  approaching_mrv: colors.secondary,
  at_mrv:          colors.danger,
  exceeded_mrv:    colors.danger,
}

const COMPACT_MUSCLES: MuscleGroup[] = ['quads', 'chest', 'hamstrings', 'upper_back', 'lower_back']

function VolumeCompactCard() {
  const { data } = useWeeklyVolume()

  return (
    <View style={styles.volumeCard}>
      <View style={styles.volumeCardHeader}>
        <Text style={styles.volumeCardTitle}>Weekly Volume</Text>
        <TouchableOpacity onPress={() => router.push('/volume')} activeOpacity={0.7}>
          <Text style={styles.volumeViewAll}>View All →</Text>
        </TouchableOpacity>
      </View>

      {!data ? (
        <Text style={styles.volumeLoading}>Loading…</Text>
      ) : (
        COMPACT_MUSCLES.map((muscle) => {
          const sets   = data.weekly[muscle]
          const mrv    = data.config[muscle].mrv
          const status = data.status[muscle]
          const fillPct = mrv > 0 ? Math.min(100, (sets / mrv) * 100) : 0
          const isOver  = status === 'at_mrv' || status === 'exceeded_mrv'

          return (
            <View key={muscle} style={styles.volumeRow}>
              <Text style={styles.volumeRowLabel}>{MUSCLE_LABELS[muscle]}</Text>
              <View style={styles.volumeBarTrack}>
                <View
                  style={[
                    styles.volumeBarFill,
                    { width: `${fillPct}%`, backgroundColor: BAR_COLORS[status] },
                  ]}
                />
              </View>
              <Text style={[styles.volumeRowSets, isOver && styles.volumeRowSetsOver]}>
                {sets}/{mrv}{isOver ? ' ⚠' : ''}
              </Text>
            </View>
          )
        })
      )}
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const { user } = useAuth()
  const { data: session, isLoading: sessionLoading } = useTodaySession()
  const { data: program, isLoading: programLoading } = useActiveProgram()
  const { data: volumeData } = useWeeklyVolume()
  const { data: cycleContext } = useCyclePhase()
  const queryClient = useQueryClient()

  const { data: disruptions } = useQuery({
    queryKey: ['disruptions', 'active', user?.id],
    queryFn: () => getActiveDisruptions(user!.id),
    enabled: !!user?.id,
  })

  const { data: streakData } = useQuery({
    queryKey: ['achievements', 'streak', user?.id],
    queryFn: () => getStreakData(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  })

  if (sessionLoading || programLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    )
  }

  const mrvWarningMuscles = volumeData
    ? (Object.entries(volumeData.status) as [MuscleGroup, VolumeStatus][])
        .filter(([, s]) => s === 'at_mrv' || s === 'exceeded_mrv')
        .map(([m]) => MUSCLE_LABELS[m])
    : []

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>PARAKEET</Text>
        {(streakData?.currentStreak ?? 0) >= 1 && (
          <StreakPill
            currentStreak={streakData!.currentStreak}
            onPress={() => router.push('/profile/achievements')}
          />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!program ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Welcome to Parakeet</Text>
            <Text style={styles.emptySubtitle}>
              Create a program to get started.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/(auth)/onboarding/lift-maxes')}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Create Program</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Cycle phase pill */}
            {cycleContext && (
              <TouchableOpacity
                style={[
                  styles.cyclePhasePill,
                  { backgroundColor: CYCLE_PHASE_BG[cycleContext.phase] },
                ]}
                onPress={() => router.push('/settings/cycle-tracking')}
                activeOpacity={0.7}
              >
                <Text style={[styles.cyclePhasePillText, { color: CYCLE_PHASE_TEXT[cycleContext.phase] }]}>
                  {CYCLE_PHASE_LABELS[cycleContext.phase]} · Day {cycleContext.dayOfCycle}
                </Text>
              </TouchableOpacity>
            )}

            {mrvWarningMuscles.length > 0 && (
              <View style={styles.mrvBanner}>
                <Text style={styles.mrvBannerText}>
                  {mrvWarningMuscles.join(', ')} {mrvWarningMuscles.length === 1 ? 'has' : 'have'} reached weekly MRV — volume automatically reduced.
                </Text>
              </View>
            )}

            {session?.status === 'completed' ? (
              <View style={styles.workoutDoneCard}>
                <Text style={styles.workoutDoneTitle}>Workout Done ✓</Text>
                <Text style={styles.workoutDoneSubtitle}>
                  {session.primary_lift.charAt(0).toUpperCase() + session.primary_lift.slice(1)} — great work today.
                </Text>
              </View>
            ) : session ? (
              <>
                <WorkoutCard
                  session={session}
                  activeDisruptions={disruptions ?? []}
                  onSkipComplete={() =>
                    queryClient.invalidateQueries({ queryKey: ['session', 'today'] })
                  }
                  onDisruptionResolved={() =>
                    queryClient.invalidateQueries({ queryKey: ['disruptions', 'active', user?.id] })
                  }
                />
                {/* Ovulatory info chip — squat days only */}
                {cycleContext?.isOvulatoryWindow && session.primary_lift === 'squat' && (
                  <View style={styles.ovulatoryChip}>
                    <Text style={styles.ovulatoryChipText}>
                      ℹ Ovulatory phase — high-load squat day. Focus on knee tracking and warm-up quality.
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.restDayCard}>
                <Text style={styles.restDayTitle}>Rest Day</Text>
                <Text style={styles.restDaySubtitle}>
                  Keep recovering — next session coming up soon.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.reportIssueButton}
              onPress={() => router.push('/disruption-report/report')}
              activeOpacity={0.75}
            >
              <Text style={styles.reportIssueButtonText}>⚠ Log a Disruption</Text>
            </TouchableOpacity>

            <VolumeCompactCard />
          </>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[5],
  },
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.black,
    color: colors.primary,
    letterSpacing: typography.letterSpacing.wider,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing[8],
    gap: spacing[3],
  },
  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.extrabold,
    color: colors.text,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing[8],
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
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
  // Cycle phase pill
  cyclePhasePill: {
    alignSelf: 'flex-start',
    marginHorizontal: spacing[4],
    borderRadius: radii.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
  },
  cyclePhasePillText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  // Ovulatory info chip
  ovulatoryChip: {
    backgroundColor: palette.amber50,
    marginHorizontal: spacing[4],
    borderRadius: radii.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
  },
  ovulatoryChipText: {
    fontSize: typography.sizes.sm,
    color: palette.amber800,
    lineHeight: 18,
  },
  // Workout done card
  workoutDoneCard: {
    backgroundColor: colors.successMuted,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.success,
    padding: spacing[7],
    marginHorizontal: spacing[4],
    alignItems: 'center' as const,
  },
  workoutDoneTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.extrabold,
    color: colors.success,
    marginBottom: spacing[2],
    letterSpacing: typography.letterSpacing.wide,
  },
  workoutDoneSubtitle: {
    fontSize: typography.sizes.base,
    color: colors.success,
    textAlign: 'center' as const,
    lineHeight: 22,
    opacity: 0.8,
  },
  // Rest day card
  restDayCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[7],
    marginHorizontal: spacing[4],
    alignItems: 'center',
  },
  restDayTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.extrabold,
    color: colors.text,
    marginBottom: spacing[2],
    letterSpacing: typography.letterSpacing.wide,
  },
  restDaySubtitle: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // MRV warning banner
  mrvBanner: {
    backgroundColor: colors.dangerMuted,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    marginHorizontal: spacing[4],
    borderRadius: radii.xs,
  },
  mrvBannerText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    lineHeight: 18,
  },
  // Volume compact card
  volumeCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginHorizontal: spacing[4],
  },
  volumeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  volumeCardTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
    letterSpacing: typography.letterSpacing.wide,
  },
  volumeViewAll: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  volumeLoading: {
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
    gap: spacing[2],
  },
  volumeRowLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    width: 76,
  },
  volumeBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.bgMuted,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  volumeBarFill: {
    height: '100%',
    borderRadius: radii.full,
  },
  volumeRowSets: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
    width: 52,
    textAlign: 'right',
  },
  volumeRowSetsOver: {
    color: colors.danger,
    fontWeight: typography.weights.semibold,
  },
  reportIssueButton: {
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radii.md,
    paddingVertical: spacing[3],
    marginHorizontal: spacing[4],
    alignItems: 'center',
  },
  reportIssueButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.warning,
    letterSpacing: typography.letterSpacing.wide,
  },
})
