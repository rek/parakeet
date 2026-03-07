import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getStreakData } from '@modules/achievements';
import { useAuth } from '@modules/auth';
import { useCyclePhase } from '@modules/cycle-tracking';
import { getActiveDisruptions } from '@modules/disruptions';
import { useActiveProgram } from '@modules/program';
import {
  fetchMotivationalContext,
  generateMotivationalMessage,
  useInProgressSession,
  useTodaySessions,
} from '@modules/session';
import type { CompletedSessionRef } from '@modules/session';
import { useWeeklyVolume } from '@modules/training-volume';
import type { MuscleGroup, VolumeStatus } from '@parakeet/training-engine';
import {
  COMPACT_VOLUME_MUSCLES,
  MUSCLE_LABELS_COMPACT,
} from '@shared/constants/training';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StreakPill } from '../../components/achievements/StreakPill';
import { DisruptionChipsRow } from '../../components/disruption/DisruptionChipsRow';
import { WorkoutCard } from '../../components/training/WorkoutCard';
import { colors, palette, radii, spacing, typography } from '../../theme';

// ── Cycle phase constants ─────────────────────────────────────────────────────

const CYCLE_PHASE_BG: Record<string, string> = {
  menstrual: palette.red100,
  follicular: palette.emerald100,
  ovulatory: palette.amber100,
  luteal: palette.indigo100,
  late_luteal: palette.indigo100,
};
const CYCLE_PHASE_TEXT: Record<string, string> = {
  menstrual: palette.red800,
  follicular: palette.emerald800,
  ovulatory: palette.amber800,
  luteal: palette.indigo800,
  late_luteal: palette.indigo800,
};

const CYCLE_PHASE_LABELS: Record<string, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
  late_luteal: 'Late Luteal',
};

// ── Volume compact card ───────────────────────────────────────────────────────

const BAR_COLORS: Record<VolumeStatus, string> = {
  below_mev: colors.warning,
  in_range: colors.success,
  approaching_mrv: colors.secondary,
  at_mrv: colors.danger,
  exceeded_mrv: colors.danger,
};

function VolumeCompactCard() {
  const { data } = useWeeklyVolume();

  return (
    <View style={styles.volumeCard}>
      <View style={styles.volumeCardHeader}>
        <Text style={styles.volumeCardTitle}>Weekly Volume</Text>
        <TouchableOpacity
          onPress={() => router.push('/volume')}
          activeOpacity={0.7}
        >
          <Text style={styles.volumeViewAll}>View All →</Text>
        </TouchableOpacity>
      </View>

      {!data ? (
        <Text style={styles.volumeLoading}>Loading…</Text>
      ) : (
        COMPACT_VOLUME_MUSCLES.map((muscle) => {
          const sets = data.weekly[muscle];
          const mrv = data.config[muscle].mrv;
          const status = data.status[muscle];
          const fillPct = mrv > 0 ? Math.min(100, (sets / mrv) * 100) : 0;
          const isOver = status === 'at_mrv' || status === 'exceeded_mrv';

          return (
            <View key={muscle} style={styles.volumeRow}>
              <Text style={styles.volumeRowLabel}>
                {MUSCLE_LABELS_COMPACT[muscle]}
              </Text>
              <View style={styles.volumeBarTrack}>
                <View
                  style={[
                    styles.volumeBarFill,
                    {
                      width: `${fillPct}%`,
                      backgroundColor: BAR_COLORS[status],
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.volumeRowSets,
                  isOver && styles.volumeRowSetsOver,
                ]}
              >
                {sets}/{mrv}
                {isOver ? ' ⚠' : ''}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

function WorkoutDoneCard({
  sessions,
  currentStreak,
  cyclePhase,
  userId,
}: {
  sessions: CompletedSessionRef[];
  currentStreak: number;
  cyclePhase: string | null;
  userId: string;
}) {
  const sessionIds = sessions.map((s) => s.id);

  const { data: message, isLoading, error } = useQuery({
    queryKey: ['motivational-message', ...sessionIds],
    queryFn: async () => {
      const ctx = await fetchMotivationalContext(sessions, currentStreak, cyclePhase);
      return generateMotivationalMessage(ctx, sessionIds, userId);
    },
    staleTime: Infinity,
    retry: false,
  });

  if (error) console.warn('Motivational message error:', error);

  const lifts = sessions
    .map(
      (s) => s.primary_lift.charAt(0).toUpperCase() + s.primary_lift.slice(1)
    )
    .join(', ');

  return (
    <View style={styles.workoutDoneCard}>
      <Text style={styles.workoutDoneTitle}>Workout Done ✓</Text>
      <Text style={styles.workoutDoneLift}>{lifts}</Text>
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={colors.success}
          style={{ opacity: 0.5, marginTop: spacing[2] }}
        />
      ) : message ? (
        <Text style={styles.workoutDoneSubtitle}>{message}</Text>
      ) : null}
    </View>
  );
}

export default function TodayScreen() {
  const { user } = useAuth();
  const { data: sessions = [], isLoading: sessionLoading } = useTodaySessions();
  const { data: activeSession } = useInProgressSession();
  const { data: program, isLoading: programLoading } = useActiveProgram();
  const { data: volumeData } = useWeeklyVolume();
  const { data: cycleContext } = useCyclePhase();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }, [queryClient]);

  const { data: disruptions } = useQuery({
    queryKey: ['disruptions', 'active', user?.id],
    queryFn: () => getActiveDisruptions(user!.id),
    enabled: !!user?.id,
  });

  const { data: streakData } = useQuery({
    queryKey: ['achievements', 'streak', user?.id],
    queryFn: () => getStreakData(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  if (sessionLoading || programLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const mrvWarningMuscles = volumeData
    ? (Object.entries(volumeData.status) as [MuscleGroup, VolumeStatus][])
        .filter(([, s]) => s === 'at_mrv' || s === 'exceeded_mrv')
        .map(([m]) => MUSCLE_LABELS_COMPACT[m])
    : [];

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
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
                <Text
                  style={[
                    styles.cyclePhasePillText,
                    { color: CYCLE_PHASE_TEXT[cycleContext.phase] },
                  ]}
                >
                  {CYCLE_PHASE_LABELS[cycleContext.phase]} · Day{' '}
                  {cycleContext.dayOfCycle}
                </Text>
              </TouchableOpacity>
            )}

            {mrvWarningMuscles.length > 0 && (
              <View style={styles.mrvBanner}>
                <Text style={styles.mrvBannerText}>
                  {mrvWarningMuscles.join(', ')}{' '}
                  {mrvWarningMuscles.length === 1 ? 'has' : 'have'} reached
                  weekly MRV — volume automatically reduced.
                </Text>
              </View>
            )}

            {disruptions && disruptions.length > 0 && (
              <DisruptionChipsRow
                disruptions={disruptions}
                userId={user!.id}
                onResolved={() =>
                  queryClient.invalidateQueries({
                    queryKey: ['disruptions', 'active', user?.id],
                  })
                }
              />
            )}

            {sessions.length === 0 ? (
              <View style={styles.restDayCard}>
                <Text style={styles.restDayTitle}>Rest Day</Text>
                <Text style={styles.restDaySubtitle}>
                  Keep recovering — next session coming up soon.
                </Text>
              </View>
            ) : (
              (() => {
                  const order: Record<string, number> = {
                    in_progress: 0,
                    planned: 1,
                    completed: 2,
                    skipped: 3,
                    missed: 4,
                  };
                  const sorted = [...sessions].sort(
                    (a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5)
                  );
                  const completedSessions = sorted.filter(
                    (s) => s.status === 'completed'
                  );
                  const otherSessions = sorted.filter(
                    (s) => s.status !== 'completed'
                  );
                  return (
                    <>
                      {completedSessions.length > 0 && (
                        <WorkoutDoneCard
                          sessions={completedSessions}
                          currentStreak={streakData?.currentStreak ?? 0}
                          cyclePhase={cycleContext?.phase ?? null}
                          userId={user!.id}
                        />
                      )}
                      {otherSessions.map((s) => {
                        const isLocked =
                          s.status === 'planned' &&
                          !!activeSession &&
                          activeSession.id !== s.id;
                        return (
                          <View key={s.id}>
                            <WorkoutCard
                              session={s}
                              isLocked={isLocked}
                              onSkipComplete={() =>
                                queryClient.invalidateQueries({
                                  queryKey: ['session', 'today'],
                                })
                              }
                            />
                            {cycleContext?.isOvulatoryWindow &&
                              s.primary_lift === 'squat' && (
                                <View style={styles.ovulatoryChip}>
                                  <Text style={styles.ovulatoryChipText}>
                                    ℹ Ovulatory phase — high-load squat day. Focus on
                                    knee tracking and warm-up quality.
                                  </Text>
                                </View>
                              )}
                          </View>
                        );
                      })}
                    </>
                  );
                })()
            )}

            <TouchableOpacity
              style={styles.reportIssueButton}
              onPress={() => router.push('/disruption-report/report')}
              activeOpacity={0.75}
            >
              <Text style={styles.reportIssueButtonText}>
                ⚠ Log a Disruption
              </Text>
            </TouchableOpacity>

            <VolumeCompactCard />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
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
    marginBottom: spacing[1],
    letterSpacing: typography.letterSpacing.wide,
  },
  workoutDoneLift: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.success,
    textAlign: 'center' as const,
    opacity: 0.7,
  },
  workoutDoneSubtitle: {
    fontSize: typography.sizes.sm,
    color: palette.amber500,
    textAlign: 'center' as const,
    lineHeight: 20,
    marginTop: spacing[2],
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
  disruptionBanner: {
    backgroundColor: colors.warningMuted,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    marginHorizontal: spacing[4],
    borderRadius: radii.xs,
  },
  disruptionBannerText: {
    fontSize: typography.sizes.sm,
    color: colors.warning,
    lineHeight: 18,
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
});
