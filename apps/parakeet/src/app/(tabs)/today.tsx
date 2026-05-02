import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { StreakPill, useStreak } from '@modules/achievements';
import { useAuth } from '@modules/auth';
import { getLatestWeeklyReview } from '@modules/body-review';
import {
  CYCLE_PHASE_BG,
  CYCLE_PHASE_LABELS,
  CYCLE_PHASE_TEXT,
  useCyclePhase,
} from '@modules/cycle-tracking';
import {
  DisruptionChipsRow,
  resolveDisruption,
  updateDisruptionEndDate,
  useActiveDisruptions,
} from '@modules/disruptions';
import { useFeatureEnabled } from '@modules/feature-flags';
import { useActiveProgram } from '@modules/program';
import {
  getReadyCachedJitData,
  partitionTodaySessions,
  skipSession,
  useInProgressSession,
  useMotivationalMessage,
  useRefreshAll,
  useSessionLifecycle,
  useTodaySessions,
  WorkoutCard,
} from '@modules/session';
import type { CompletedSessionRef } from '@modules/session';
import {
  getMrvWarningMuscles,
  getVolumeStatusColor,
  isVolumeOverMrv,
  useWeeklyVolume,
  volumeFillPct,
} from '@modules/training-volume';
import { captureException } from '@platform/utils/captureException';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  COMPACT_VOLUME_MUSCLES,
  MUSCLE_LABELS_COMPACT,
} from '@shared/constants/training';
import { capitalize } from '@shared/utils/string';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HeaderMenuButton } from '../../components/ui/HeaderMenuButton';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { palette, radii, spacing, typography } from '../../theme';
import type { ColorScheme } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

// ── Styles builder ────────────────────────────────────────────────────────────

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
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
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
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
    // Weekly review nudge card
    weeklyReviewCard: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      marginHorizontal: spacing[4],
    },
    weeklyReviewTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.bold,
      color: colors.text,
      marginBottom: spacing[0.5],
    },
    weeklyReviewSubtext: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
      marginBottom: spacing[3],
    },
    weeklyReviewButtons: {
      flexDirection: 'row' as const,
      gap: spacing[2],
    },
    weeklyReviewButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: radii.sm,
      paddingVertical: spacing[2],
      alignItems: 'center' as const,
    },
    weeklyReviewButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textInverse,
    },
    weeklyReviewLaterButton: {
      flex: 1,
      backgroundColor: colors.bgMuted,
      borderRadius: radii.sm,
      paddingVertical: spacing[2],
      alignItems: 'center' as const,
    },
    weeklyReviewLaterButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
    adHocButton: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: spacing[3],
      marginHorizontal: spacing[4],
      alignItems: 'center',
    },
    adHocButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
      letterSpacing: typography.letterSpacing.wide,
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
}

// ── Volume compact card ───────────────────────────────────────────────────────

function VolumeCompactCard() {
  const { colors } = useTheme();
  const { data } = useWeeklyVolume();

  const styles = useMemo(() => buildStyles(colors), [colors]);

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
          const fillPct = volumeFillPct(sets, mrv);
          const isOver = isVolumeOverMrv(status);

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
                      backgroundColor: getVolumeStatusColor(status, colors),
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

// ── Session list ──────────────────────────────────────────────────────────────

function TodaySessionsList({
  sessions,
}: {
  sessions: NonNullable<ReturnType<typeof useTodaySessions>['data']>;
}) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { data: activeSession } = useInProgressSession();
  const { data: streakData } = useStreak();
  const { data: cycleContext } = useCyclePhase();
  const { invalidateSessionCache } = useSessionLifecycle();
  const showMotivational = useFeatureEnabled('motivationalMessages');
  const showCycleTracking = useFeatureEnabled('cycleTracking');
  const styles = useMemo(() => buildStyles(colors), [colors]);

  const { completed: completedSessions, upcoming: otherSessions } =
    partitionTodaySessions(sessions);

  return (
    <>
      {completedSessions.length > 0 && (
        <WorkoutDoneCard
          sessions={completedSessions}
          currentStreak={streakData?.currentStreak ?? 0}
          cyclePhase={cycleContext?.phase ?? null}
          userId={user!.id}
          showMotivational={showMotivational}
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
              onStart={(sessionId) => {
                const isFreeForm = s.program_id === null && !s.primary_lift;
                if (isFreeForm) {
                  router.push({
                    pathname: '/session/[sessionId]',
                    params: { sessionId, freeForm: '1' },
                  });
                } else {
                  router.push({
                    pathname: '/session/soreness',
                    params: { sessionId },
                  });
                }
              }}
              onResume={async (sessionId) => {
                const isFreeForm = s.program_id === null && !s.primary_lift;
                if (isFreeForm) {
                  router.push({
                    pathname: '/session/[sessionId]',
                    params: { sessionId, freeForm: '1' },
                  });
                  return;
                }
                const jit = await getReadyCachedJitData();
                if (!jit) {
                  router.push({
                    pathname: '/session/soreness',
                    params: { sessionId },
                  });
                } else {
                  router.push({
                    pathname: '/session/[sessionId]',
                    params: { sessionId, jitData: jit },
                  });
                }
              }}
              onSkip={async (sessionId, reason) => {
                await skipSession(sessionId, reason);
              }}
              onSkipComplete={() => invalidateSessionCache()}
            />
            {showCycleTracking &&
              cycleContext?.isOvulatoryWindow &&
              s.primary_lift === 'squat' && (
                <View style={styles.ovulatoryChip}>
                  <Text style={styles.ovulatoryChipText}>
                    ℹ Ovulatory phase — high-load squat day. Focus on knee
                    tracking and warm-up quality.
                  </Text>
                </View>
              )}
          </View>
        );
      })}
    </>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

function WorkoutDoneCard({
  sessions,
  currentStreak,
  cyclePhase,
  userId,
  showMotivational,
}: {
  sessions: CompletedSessionRef[];
  currentStreak: number;
  cyclePhase: string | null;
  userId: string;
  showMotivational: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  const {
    data: message,
    isLoading,
    error,
  } = useMotivationalMessage({
    sessions,
    currentStreak,
    cyclePhase,
    userId,
    enabled: showMotivational,
  });

  if (error) {
    console.warn('Motivational message error:', error);
    captureException(error);
  }

  const lifts = sessions
    .map((s) => capitalize(s.primary_lift ?? ''))
    .join(', ');

  return (
    <View style={styles.workoutDoneCard}>
      <Text style={styles.workoutDoneTitle}>Workout Done ✓</Text>
      <Text style={styles.workoutDoneLift}>{lifts}</Text>
      {showMotivational && isLoading ? (
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
  const { colors } = useTheme();
  const { user } = useAuth();
  const {
    data: sessions = [],
    isLoading: sessionLoading,
    isError: sessionError,
  } = useTodaySessions();
  const { data: program, isLoading: programLoading } = useActiveProgram();
  const { data: volumeData } = useWeeklyVolume();
  const { data: cycleContext } = useCyclePhase();
  const { invalidateSessionCache } = useSessionLifecycle();
  const { refreshAll } = useRefreshAll();
  const [refreshing, setRefreshing] = useState(false);
  const [pendingReview, setPendingReview] = useState<{
    programId: string | null;
    weekNumber: number;
  } | null>(null);
  const [pendingCalibration, setPendingCalibration] = useState<{
    modifierSource: string;
    currentDefault: number;
    proposed: number;
    sampleCount: number;
    meanBias: number;
    reason: string;
  } | null>(null);

  const styles = useMemo(() => buildStyles(colors), [colors]);

  const showStreaks = useFeatureEnabled('streaks');
  const showCycleTracking = useFeatureEnabled('cycleTracking');
  const showVolume = useFeatureEnabled('volumeDashboard');
  const showDisruptions = useFeatureEnabled('disruptions');
  const showAdHoc = useFeatureEnabled('adHocWorkouts');

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  }, [refreshAll]);

  // Invalidate session queries when this tab gains focus (e.g. returning from
  // the ad-hoc or session screens). refetchOnWindowFocus is inert in React
  // Native without a global focusManager, so this handles tab switches.
  useFocusEffect(
    useCallback(() => {
      invalidateSessionCache();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Check for a pending weekly body review (stored after end-of-week session)
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      AsyncStorage.getItem('pending_weekly_review')
        .then((raw) => {
          if (!raw) {
            setPendingReview(null);
            return;
          }
          const data = JSON.parse(raw) as {
            programId: string | null;
            weekNumber: number;
          };
          return getLatestWeeklyReview(
            user.id,
            data.programId ?? '',
            data.weekNumber
          ).then((existing) => {
            if (existing) {
              void AsyncStorage.removeItem('pending_weekly_review');
              setPendingReview(null);
            } else {
              setPendingReview(data);
            }
          });
        })
        .catch(captureException);
    }, [user?.id])
  );

  // Check for a pending calibration prompt (stored after LLM review flags askUser)
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('pending_calibration_prompt')
        .then((raw) => {
          if (!raw) {
            setPendingCalibration(null);
            return;
          }
          setPendingCalibration(JSON.parse(raw));
        })
        .catch(captureException);
    }, [])
  );

  const { data: disruptions, invalidateDisruptions } = useActiveDisruptions();

  const { data: streakData } = useStreak();

  if (sessionLoading || programLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const mrvWarningMuscles = volumeData
    ? getMrvWarningMuscles(volumeData.status).map(
        (m) => MUSCLE_LABELS_COMPACT[m]
      )
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <HeaderMenuButton />
            <Text style={styles.title}>PARAKEET</Text>
          </View>
          {showStreaks && (streakData?.currentStreak ?? 0) >= 1 && (
            <StreakPill
              currentStreak={streakData!.currentStreak}
              onPress={() => router.push('/profile/achievements')}
            />
          )}
        </View>
      </ScreenHeader>

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
            {showCycleTracking && cycleContext && (
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

            {showVolume && mrvWarningMuscles.length > 0 && (
              <View style={styles.mrvBanner}>
                <Text style={styles.mrvBannerText}>
                  {mrvWarningMuscles.join(', ')}{' '}
                  {mrvWarningMuscles.length === 1 ? 'has' : 'have'} reached
                  weekly MRV — volume automatically reduced.
                </Text>
              </View>
            )}

            {showDisruptions && disruptions && disruptions.length > 0 && (
              <DisruptionChipsRow
                disruptions={disruptions}
                onResolve={(id) => resolveDisruption(id, user!.id)}
                onUpdateEndDate={(id, endDate) =>
                  updateDisruptionEndDate(id, user!.id, endDate)
                }
                onResolved={() => invalidateDisruptions()}
              />
            )}

            {/* Calibration adjustment prompt */}
            {pendingCalibration && (
              <View style={styles.weeklyReviewCard}>
                <Text style={styles.weeklyReviewTitle}>
                  Training Adjustment
                </Text>
                <Text style={styles.weeklyReviewSubtext}>
                  {pendingCalibration.reason} Based on{' '}
                  {pendingCalibration.sampleCount} sessions.
                </Text>
                <View style={styles.weeklyReviewButtons}>
                  <TouchableOpacity
                    style={styles.weeklyReviewButton}
                    onPress={async () => {
                      try {
                        await AsyncStorage.removeItem(
                          'pending_calibration_prompt'
                        );
                      } catch (err) {
                        captureException(err);
                      }
                      setPendingCalibration(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.weeklyReviewButtonText}>
                      Sounds right
                    </Text>
                  </TouchableOpacity>
                  {/* TODO: "Not sure — let's discuss" button opens LLM conversation */}
                  <TouchableOpacity
                    style={styles.weeklyReviewLaterButton}
                    onPress={async () => {
                      try {
                        // Revert the adjustment to the previous value
                        const { upsertModifierCalibration } = await import(
                          '@modules/jit'
                        );
                        await upsertModifierCalibration({
                          userId: user!.id,
                          modifierSource: pendingCalibration.modifierSource as
                            | 'readiness'
                            | 'cycle_phase'
                            | 'soreness',
                          adjustment: pendingCalibration.currentDefault,
                          confidence: 'medium',
                          sampleCount: pendingCalibration.sampleCount,
                          meanBias: pendingCalibration.meanBias,
                        });
                        await AsyncStorage.removeItem(
                          'pending_calibration_prompt'
                        );
                      } catch (err) {
                        captureException(err);
                      }
                      setPendingCalibration(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.weeklyReviewLaterButtonText}>
                      Keep current
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Weekly body review nudge */}
            {pendingReview && (
              <View style={styles.weeklyReviewCard}>
                <Text style={styles.weeklyReviewTitle}>
                  Weekly body check-in ready
                </Text>
                <Text style={styles.weeklyReviewSubtext}>
                  How did your body hold up this week?
                </Text>
                <View style={styles.weeklyReviewButtons}>
                  <TouchableOpacity
                    style={styles.weeklyReviewButton}
                    onPress={() => {
                      void AsyncStorage.removeItem('pending_weekly_review');
                      setPendingReview(null);
                      router.push({
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        pathname: '/session/weekly-review' as any,
                        params: {
                          programId: pendingReview.programId ?? '',
                          weekNumber: String(pendingReview.weekNumber),
                        },
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.weeklyReviewButtonText}>Review</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.weeklyReviewLaterButton}
                    onPress={() => setPendingReview(null)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.weeklyReviewLaterButtonText}>
                      Later
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {sessionError && sessions.length === 0 ? (
              <TouchableOpacity
                style={[styles.restDayCard, { borderColor: colors.danger }]}
                onPress={handleRefresh}
                activeOpacity={0.7}
              >
                <Text style={styles.restDayTitle}>Could not load sessions</Text>
                <Text style={styles.restDaySubtitle}>
                  Tap to retry, or pull down to refresh.
                </Text>
              </TouchableOpacity>
            ) : sessions.length === 0 ? (
              <View style={styles.restDayCard}>
                <Text style={styles.restDayTitle}>Rest Day</Text>
                <Text style={styles.restDaySubtitle}>
                  Keep recovering — next session coming up soon.
                </Text>
              </View>
            ) : (
              <TodaySessionsList sessions={sessions} />
            )}

            {showAdHoc && (
              <TouchableOpacity
                style={styles.adHocButton}
                onPress={() => router.push('/session/adhoc')}
                activeOpacity={0.75}
              >
                <Text style={styles.adHocButtonText}>+ Ad-Hoc Workout</Text>
              </TouchableOpacity>
            )}

            {showDisruptions && (
              <TouchableOpacity
                style={styles.reportIssueButton}
                onPress={() => router.push('/disruption-report/report')}
                activeOpacity={0.75}
              >
                <Text style={styles.reportIssueButtonText}>
                  ⚠ Log a Disruption
                </Text>
              </TouchableOpacity>
            )}

            {showVolume && <VolumeCompactCard />}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
