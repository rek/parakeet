import { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@modules/auth';
import { PartnerSection } from '@modules/gym-partners';
import { computeRpeAdjustmentNote } from '@modules/jit';
import {
  calculateSets,
  determineCurrentWeek,
  groupByWeek,
  useActiveProgram,
  useEndProgram,
  useNextSessionPreview,
  WeekRow,
} from '@modules/program';
import type { ProgramSession } from '@modules/program';
import { useInProgressSession, useTodaySession } from '@modules/session';
import type { IntensityType, Lift } from '@parakeet/shared-types';
import { useSessionStore } from '@platform/store/sessionStore';
import { captureException } from '@platform/utils/captureException';
import { capitalize } from '@shared/utils/string';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HeaderMenuButton } from '../../components/ui/HeaderMenuButton';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { ScreenTitle } from '../../components/ui/ScreenTitle';
import { spacing, typography } from '../../theme';
import type { ColorScheme } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

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
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing[1],
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
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
    endProgramText: {
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
    // Unending view
    unendingBody: {
      flex: 1,
      paddingHorizontal: spacing[5],
      paddingTop: spacing[2],
    },
    nextSessionCard: {
      backgroundColor: colors.bgSurface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[6],
    },
    nextSessionLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: spacing[2],
    },
    nextSessionLift: {
      fontSize: typography.sizes['2xl'],
      fontWeight: typography.weights.black,
      color: colors.text,
      marginBottom: spacing[3],
    },
    badgeRow: {
      flexDirection: 'row',
      gap: spacing[2],
      marginBottom: spacing[4],
    },
    badge: {
      backgroundColor: colors.primaryMuted,
      borderRadius: 8,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1],
    },
    badgeSecondary: {
      backgroundColor: colors.bgMuted,
    },
    badgeText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
    nextSessionNote: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
    estimateRow: {
      marginTop: spacing[3],
      paddingTop: spacing[3],
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginBottom: spacing[3],
      gap: spacing[1],
    },
    estimateText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    lastRpeText: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
    },
    checkinCard: {
      backgroundColor: colors.bgSurface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[5],
      marginTop: spacing[5],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    checkinLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      flex: 1,
      marginRight: spacing[3],
    },
    checkinButton: {
      backgroundColor: colors.primaryMuted,
      borderRadius: 10,
      paddingVertical: spacing[2],
      paddingHorizontal: spacing[4],
    },
    checkinButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
  });
}

export default function ProgramScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { data: program, isLoading } = useActiveProgram();
  const { data: todaySession } = useTodaySession();
  const { data: activeSession } = useInProgressSession();
  const { loading: authLoading } = useAuth();

  const isUnending = program?.program_mode === 'unending';

  const nextLift = todaySession?.primary_lift as Lift | undefined;

  const { oneRmKg, formulaConfig, liftHistory } = useNextSessionPreview({
    enabled: isUnending,
    nextLift,
  });

  const { endProgram, isPending: isEndingProgram } = useEndProgram({
    isUnending,
  });

  function handleSessionPress(session: ProgramSession) {
    if (session.status === 'in_progress') {
      const jit = useSessionStore.getState().cachedJitData;
      router.push({
        pathname: '/session/[sessionId]',
        params: {
          sessionId: session.id,
          ...(jit ? { jitData: jit } : {}),
        },
      });
      return;
    }
    router.push({
      pathname: '/session/soreness',
      params: { sessionId: session.id },
    });
  }

  function confirmEndProgram() {
    if (!program) return;
    const message = isUnending
      ? 'This will close your program and generate a full cycle review.'
      : 'This will archive your current program. You can start a new one anytime.';
    Alert.alert('End Program', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Program',
        style: 'destructive',
        onPress: () => endProgram(program.id),
      },
    ]);
  }

  if (isLoading || authLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!program) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader>
          <View style={styles.headerLeft}>
            <HeaderMenuButton />
            <ScreenTitle>My Program</ScreenTitle>
          </View>
        </ScreenHeader>
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
    );
  }

  if (isUnending) {
    const counter = program.unending_session_counter ?? 0;

    const blockNum = (todaySession?.block_number ?? 1) as 1 | 2 | 3;
    const intensityType = (todaySession?.intensity_type ??
      'heavy') as IntensityType;
    let estimatedSets = null;
    try {
      if (oneRmKg && formulaConfig && todaySession && nextLift) {
        estimatedSets = calculateSets(
          nextLift,
          intensityType,
          blockNum,
          oneRmKg,
          formulaConfig
        );
      }
    } catch (err) {
      captureException(err);
    }
    const firstSet = estimatedSets?.[0] ?? null;
    const setCount = estimatedSets?.length ?? null;
    const lastSessionRpe = liftHistory?.entries?.[0]?.sessionRpe ?? null;

    const repsLabel = firstSet
      ? firstSet.reps_range
        ? `${firstSet.reps_range[0]}–${firstSet.reps_range[1]}`
        : `${firstSet.reps}`
      : null;

    const rpeTarget = firstSet?.rpe_target ?? null;
    const rpeAdjustNote = computeRpeAdjustmentNote(rpeTarget, lastSessionRpe);

    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <HeaderMenuButton />
              <ScreenTitle>My Program</ScreenTitle>
            </View>
            <TouchableOpacity
              onPress={confirmEndProgram}
              disabled={isEndingProgram}
            >
              <Text style={styles.endProgramText}>End Program</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>Unending · Session {counter}</Text>
        </ScreenHeader>

        <View style={styles.unendingBody}>
          {todaySession ? (
            <View style={styles.nextSessionCard}>
              <Text style={styles.nextSessionLabel}>Next Session</Text>
              <Text style={styles.nextSessionLift}>
                {capitalize(todaySession.primary_lift!)}
              </Text>
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {capitalize(todaySession.intensity_type!)}
                  </Text>
                </View>
                {todaySession.block_number != null && (
                  <View style={[styles.badge, styles.badgeSecondary]}>
                    <Text style={styles.badgeText}>
                      Block {todaySession.block_number}
                    </Text>
                  </View>
                )}
              </View>
              {firstSet && (
                <View style={styles.estimateRow}>
                  <Text style={styles.estimateText}>
                    ~{firstSet.weight_kg}kg · {setCount}×{repsLabel}
                    {rpeTarget != null ? ` · RPE ${rpeTarget}` : ''}
                  </Text>
                  {lastSessionRpe != null && (
                    <Text style={styles.lastRpeText}>
                      Last RPE: {lastSessionRpe.toFixed(1)}
                      {rpeAdjustNote}
                    </Text>
                  )}
                </View>
              )}
              <Text style={styles.nextSessionNote}>
                {firstSet
                  ? 'Formula estimate · adjusted at session start'
                  : 'Sets generated when you start'}
              </Text>
            </View>
          ) : (
            <View style={styles.nextSessionCard}>
              <Text style={styles.nextSessionNote}>Loading next session…</Text>
            </View>
          )}
          <View style={styles.checkinCard}>
            <Text style={styles.checkinLabel}>
              How is your body holding up?
            </Text>
            <TouchableOpacity
              style={styles.checkinButton}
              onPress={() =>
                router.push({
                  pathname: '/session/weekly-review' as any,
                  params: {
                    programId: program.id,
                    weekNumber: String(todaySession?.week_number ?? 0),
                  },
                })
              }
              activeOpacity={0.8}
            >
              <Text style={styles.checkinButtonText}>Body Check-in</Text>
            </TouchableOpacity>
          </View>
          <PartnerSection />
        </View>
      </SafeAreaView>
    );
  }

  // Scheduled program — existing grid view
  const sessions: ProgramSession[] = program.sessions ?? [];
  const weekGroups = groupByWeek(sessions);
  const currentWeek = determineCurrentWeek(sessions);

  const currentWeekSessions = sessions.filter(
    (s) => s.week_number === currentWeek
  );
  const currentBlock = currentWeekSessions[0]?.block_number ?? 1;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader>
        <View style={styles.headerRow}>
          <ScreenTitle>My Program</ScreenTitle>
          <TouchableOpacity
            onPress={confirmEndProgram}
            disabled={isEndingProgram}
          >
            <Text style={styles.endProgramText}>End Program</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          Block {currentBlock} of 3 · Week {currentWeek} of{' '}
          {program.total_weeks}
        </Text>
      </ScreenHeader>

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
            activeSessionId={activeSession?.id}
            onSessionPress={handleSessionPress}
          />
        ))}
        <View style={styles.checkinCard}>
          <Text style={styles.checkinLabel}>
            How is your body holding up?
          </Text>
          <TouchableOpacity
            style={styles.checkinButton}
            onPress={() =>
              router.push({
                pathname: '/session/weekly-review' as any,
                params: {
                  programId: program.id,
                  weekNumber: String(currentWeek),
                },
              })
            }
            activeOpacity={0.8}
          >
            <Text style={styles.checkinButtonText}>Body Check-in</Text>
          </TouchableOpacity>
        </View>
        <PartnerSection />
      </ScrollView>
    </SafeAreaView>
  );
}
