import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { useAuth } from '@modules/auth';
import {
  CYCLE_PHASE_BG,
  CYCLE_PHASE_LABELS,
  CYCLE_PHASE_TEXT,
  useCyclePhase,
} from '@modules/cycle-tracking';
import {
  buildVolumeChartData,
  getPerformanceTrends,
  getTrendConfig,
  getWeeklySetsPerLift,
  MIN_CHART_OPACITY,
} from '@modules/history';
import type { PerformanceTrend } from '@modules/history';
import { listPrograms } from '@modules/program';
import { formatSessionDisplay, getCompletedSessions } from '@modules/session';
import type { Lift } from '@parakeet/shared-types';
import type { CyclePhase } from '@parakeet/training-engine';
import { LIFT_LABELS } from '@shared/constants';
import { formatDate, formatTime } from '@shared/utils/date';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radii, spacing, typography } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type CompletedSession = Awaited<
  ReturnType<typeof getCompletedSessions>
>[number];
type LiftFilter = 'all' | Lift;

const LIFT_COLORS: Record<Lift, string> = {
  squat: palette.lime400,
  bench: palette.orange500,
  deadlift: palette.teal400,
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { data: cycleContext } = useCyclePhase();
  const { width } = useWindowDimensions();
  const chartInnerWidth = width - spacing[6] * 2 - spacing[4] * 2;

  const [liftFilter, setLiftFilter] = useState<LiftFilter>('all');

  const trendConfig = getTrendConfig(colors);

  const trendsQuery = useQuery({
    queryKey: ['performance', 'trends', user?.id],
    queryFn: () => getPerformanceTrends(user!.id),
    enabled: !!user?.id,
  });

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'completed', user?.id],
    queryFn: () => getCompletedSessions(user!.id, 0, 20),
    enabled: !!user?.id,
  });

  const programsQuery = useQuery({
    queryKey: ['programs', 'previous', user?.id],
    queryFn: async () => {
      const all = await listPrograms(user!.id);
      return (all ?? []).filter((p) => p.status !== 'active');
    },
    enabled: !!user?.id,
  });

  const volumeQuery = useQuery({
    queryKey: ['volume', 'weekly', user?.id],
    queryFn: () => getWeeklySetsPerLift(user!.id, 8),
    enabled: !!user?.id,
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: { flex: 1, backgroundColor: colors.bg },
        scrollView: { flex: 1 },
        container: {
          paddingHorizontal: spacing[6],
          paddingTop: spacing[6],
          paddingBottom: spacing[12],
        },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        screenTitle: {
          fontSize: typography.sizes['2xl'],
          fontWeight: typography.weights.black,
          color: colors.text,
          marginBottom: spacing[6],
          letterSpacing: typography.letterSpacing.tight,
        },
        sectionHeader: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.bold,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: typography.letterSpacing.widest,
          marginBottom: spacing[3],
          marginTop: spacing[2],
        },
        // Trend cards
        trendRow: {
          flexDirection: 'row',
          marginBottom: spacing[8],
          gap: spacing[2],
        },
        trendCard: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.md,
          padding: spacing[3],
          backgroundColor: colors.bgSurface,
        },
        trendLiftName: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.bold,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: typography.letterSpacing.wide,
          marginBottom: spacing[1],
        },
        trendOneRm: {
          fontSize: typography.sizes.md,
          fontWeight: typography.weights.black,
          color: colors.text,
          marginBottom: spacing[0.5],
        },
        trendArrow: {
          fontSize: typography.sizes.xl,
          fontWeight: typography.weights.bold,
          marginBottom: spacing[1.5],
        },
        trendMeta: {
          fontSize: typography.sizes.xs,
          color: colors.textTertiary,
          lineHeight: 16,
        },
        trendDetails: { color: colors.primary, marginTop: spacing[1] },
        // Volume chart
        chartCard: {
          backgroundColor: colors.bgSurface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.md,
          padding: spacing[4],
          marginBottom: spacing[8],
        },
        legendRow: {
          flexDirection: 'row',
          gap: spacing[4],
          marginTop: spacing[3],
          justifyContent: 'center',
        },
        legendItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[1.5],
        },
        legendDot: { width: 8, height: 8, borderRadius: 4 },
        legendLabel: {
          fontSize: typography.sizes.xs,
          color: colors.textSecondary,
        },
        // Session filter chips
        filterRow: {
          flexDirection: 'row',
          gap: spacing[2],
          marginBottom: spacing[3],
          flexWrap: 'wrap',
        },
        filterChip: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.sm,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[1.5],
          backgroundColor: colors.bgSurface,
        },
        filterChipActive: {
          borderColor: colors.primary,
          backgroundColor: colors.primaryMuted,
        },
        filterChipText: {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.medium,
          color: colors.textSecondary,
        },
        filterChipTextActive: {
          color: colors.primary,
          fontWeight: typography.weights.bold,
        },
        // Session rows
        sessionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: spacing[3],
          borderBottomWidth: 1,
          borderBottomColor: colors.borderMuted,
        },
        sessionRowLeft: { flex: 1, marginRight: spacing[3] },
        sessionRowTitle: {
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.medium,
          color: colors.text,
          marginBottom: spacing[0.5],
        },
        sessionRowDate: {
          fontSize: typography.sizes.sm,
          color: colors.textSecondary,
        },
        sessionRowMeta: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[2],
          flexWrap: 'wrap',
          marginTop: spacing[0.5],
        },
        phaseTag: {
          borderRadius: radii.xs,
          paddingHorizontal: spacing[1.5],
          paddingVertical: 2,
        },
        phaseTagText: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.semibold,
        },
        sessionRowChevron: {
          fontSize: typography.sizes.xl,
          color: colors.textTertiary,
          marginLeft: spacing[2],
        },
        emptyText: {
          fontSize: typography.sizes.base,
          color: colors.textTertiary,
          marginBottom: spacing[8],
        },
        // Programs
        programRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: spacing[3],
          borderBottomWidth: 1,
          borderBottomColor: colors.borderMuted,
        },
        programRowLeft: { flex: 1, marginRight: spacing[3] },
        programRowTitleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[2],
          marginBottom: spacing[0.5],
        },
        programRowTitle: {
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.semibold,
          color: colors.text,
        },
        programStatusBadge: {
          borderRadius: radii.xs,
          paddingHorizontal: spacing[1.5],
          paddingVertical: 2,
        },
        programStatusCompleted: { backgroundColor: colors.successMuted },
        programStatusAbandoned: { backgroundColor: colors.bgMuted },
        programStatusText: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.semibold,
        },
        programStatusTextCompleted: { color: colors.success },
        programStatusTextAbandoned: { color: colors.textSecondary },
        reviewButton: {
          backgroundColor: colors.primaryMuted,
          borderRadius: radii.sm,
          paddingHorizontal: spacing[3.5],
          paddingVertical: spacing[2],
          borderWidth: 1,
          borderColor: colors.primary,
        },
        reviewButtonText: {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.bold,
          color: colors.primary,
        },
        cyclePatternButton: {
          backgroundColor: palette.amber100,
          borderRadius: radii.sm,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          marginBottom: spacing[4],
          alignSelf: 'flex-start',
        },
        cyclePatternButtonText: {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.semibold,
          color: palette.amber800,
        },
      }),
    [colors]
  );

  if (trendsQuery.isLoading || sessionsQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const filteredSessions =
    liftFilter === 'all'
      ? (sessionsQuery.data ?? [])
      : (sessionsQuery.data ?? []).filter((s) => s.primary_lift === liftFilter);

  const volumeChartData = volumeQuery.data
    ? buildVolumeChartData(
        volumeQuery.data,
        LIFT_COLORS,
        liftFilter === 'all' ? undefined : liftFilter
      )
    : null;

  function renderTrendCard(trend: PerformanceTrend) {
    const { symbol, color } = trendConfig[trend.trend];
    return (
      <TouchableOpacity
        key={trend.lift}
        style={styles.trendCard}
        onPress={() => router.push(`/history/lift/${trend.lift}`)}
        activeOpacity={0.75}
      >
        <Text style={styles.trendLiftName}>
          {LIFT_LABELS[trend.lift] ?? trend.lift}
        </Text>
        <Text style={styles.trendOneRm}>
          {trend.estimatedOneRmKg.toFixed(1)} kg
        </Text>
        <Text style={[styles.trendArrow, { color }]}>{symbol}</Text>
        <Text style={styles.trendMeta}>{trend.sessionsLogged} sessions</Text>
        <Text style={[styles.trendMeta, styles.trendDetails]}>Details ›</Text>
      </TouchableOpacity>
    );
  }

  function renderSessionRow(session: CompletedSession) {
    const { liftName, intensityName } = formatSessionDisplay(session);

    return (
      <TouchableOpacity
        key={session.id}
        style={styles.sessionRow}
        onPress={() => router.push(`/history/${session.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.sessionRowLeft}>
          <Text style={styles.sessionRowTitle}>
            {intensityName ? `${liftName} — ${intensityName}` : liftName}
          </Text>
          <View style={styles.sessionRowMeta}>
            <Text style={styles.sessionRowDate}>
              {formatDate(session.completed_at ?? session.planned_date)}
              {session.completed_at && formatTime(session.completed_at)
                ? ` · ${formatTime(session.completed_at)}`
                : ''}
            </Text>
            {session.cycle_phase && (
              <View
                style={[
                  styles.phaseTag,
                  {
                    backgroundColor:
                      CYCLE_PHASE_BG[session.cycle_phase as CyclePhase],
                  },
                ]}
              >
                <Text
                  style={[
                    styles.phaseTagText,
                    {
                      color:
                        CYCLE_PHASE_TEXT[session.cycle_phase as CyclePhase],
                    },
                  ]}
                >
                  {CYCLE_PHASE_LABELS[session.cycle_phase as CyclePhase] ??
                    session.cycle_phase}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.sessionRowChevron}>›</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>History</Text>

        {/* 1RM trend cards */}
        <Text style={styles.sectionHeader}>Estimated 1RM</Text>
        {trendsQuery.data && trendsQuery.data.length > 0 ? (
          <View style={styles.trendRow}>
            {(['squat', 'bench', 'deadlift'] as Lift[]).map((lift) => {
              const trend = trendsQuery.data.find((t) => t.lift === lift);
              if (!trend) return null;
              return renderTrendCard(trend);
            })}
          </View>
        ) : (
          <Text style={styles.emptyText}>No performance data yet.</Text>
        )}

        {/* Lift filter */}
        <View style={styles.filterRow}>
          {(['all', 'squat', 'bench', 'deadlift'] as LiftFilter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterChip,
                liftFilter === f && styles.filterChipActive,
              ]}
              onPress={() => setLiftFilter(f)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  liftFilter === f && styles.filterChipTextActive,
                ]}
              >
                {f === 'all' ? 'All' : LIFT_LABELS[f]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Weekly volume chart */}
        <Text style={styles.sectionHeader}>Weekly Volume</Text>
        {volumeChartData ? (
          <View style={styles.chartCard}>
            <LineChart
              data={volumeChartData}
              width={chartInnerWidth}
              height={160}
              withDots={false}
              withShadow={false}
              withInnerLines={true}
              withOuterLines={false}
              chartConfig={{
                backgroundGradientFrom: colors.bgSurface,
                backgroundGradientTo: colors.bgSurface,
                color: (opacity = 1) =>
                  `${palette.lime400}${Math.round(Math.max(opacity, MIN_CHART_OPACITY) * 255)
                    .toString(16)
                    .padStart(2, '0')}`,
                labelColor: () => colors.textTertiary,
                strokeWidth: 2,
                propsForBackgroundLines: {
                  stroke: colors.border,
                  strokeDasharray: '',
                },
              }}
              style={{ borderRadius: radii.sm }}
            />
            <View style={styles.legendRow}>
              {volumeChartData.lifts.map((lift) => (
                <View key={lift} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: LIFT_COLORS[lift] },
                    ]}
                  />
                  <Text style={styles.legendLabel}>{LIFT_LABELS[lift]}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={[styles.emptyText, { marginBottom: spacing[8] }]}>
            {volumeQuery.isLoading ? 'Loading…' : 'No volume data yet.'}
          </Text>
        )}

        {/* Previous programs */}
        {(programsQuery.data?.length ?? 0) > 0 && (
          <>
            <Text style={styles.sectionHeader}>Previous Programs</Text>
            <View style={{ marginBottom: spacing[6] }}>
              {programsQuery.data!.map((program) => (
                <View key={program.id} style={styles.programRow}>
                  <View style={styles.programRowLeft}>
                    <View style={styles.programRowTitleRow}>
                      <Text style={styles.programRowTitle}>
                        Program v{program.version ?? 1}
                      </Text>
                      <View
                        style={[
                          styles.programStatusBadge,
                          program.status === 'completed'
                            ? styles.programStatusCompleted
                            : styles.programStatusAbandoned,
                        ]}
                      >
                        <Text
                          style={[
                            styles.programStatusText,
                            program.status === 'completed'
                              ? styles.programStatusTextCompleted
                              : styles.programStatusTextAbandoned,
                          ]}
                        >
                          {program.status === 'completed'
                            ? 'Completed'
                            : 'Abandoned'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.sessionRowDate}>
                      {program.total_weeks
                        ? `${program.total_weeks} weeks`
                        : 'Unending'}{' '}
                      · {program.training_days_per_week} days/week
                      {program.start_date
                        ? ` · Started ${formatDate(program.start_date)}`
                        : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.reviewButton}
                    onPress={() =>
                      router.push(`/history/cycle-review/${program.id}`)
                    }
                    activeOpacity={0.8}
                  >
                    <Text style={styles.reviewButtonText}>Review</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Cycle patterns */}
        {cycleContext && sessionsQuery.data?.some((s) => s.cycle_phase) && (
          <>
            <Text style={styles.sectionHeader}>Cycle</Text>
            <TouchableOpacity
              style={styles.cyclePatternButton}
              onPress={() => router.push('/history/cycle-patterns')}
              activeOpacity={0.7}
            >
              <Text style={styles.cyclePatternButtonText}>
                Cycle Patterns →
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Recent sessions */}
        <Text style={styles.sectionHeader}>Recent Sessions</Text>

        {filteredSessions.length > 0 ? (
          <View>
            {filteredSessions.map((session) => renderSessionRow(session))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No sessions yet.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
