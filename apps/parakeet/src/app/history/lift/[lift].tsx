import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import type { Lift } from '@parakeet/shared-types';
import { estimateOneRepMax_Epley, gramsToKg } from '@parakeet/training-engine';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@modules/auth';
import {
  getPerformanceByLift,
  getPerformanceTrends,
} from '@modules/history';
import { colors, palette, radii, spacing, typography } from '../../../theme';
import { formatDate, formatTime } from '@shared/utils/date';

// ── Types ─────────────────────────────────────────────────────────────────────

type IntensityFilter = 'all' | 'heavy' | 'explosive' | 'rep' | 'deload';
type ChartType = '1rm' | 'volume' | 'heaviest';

const LIFT_LABELS: Record<Lift, string> = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
};
const LIFT_COLORS: Record<Lift, string> = {
  squat: palette.lime400,
  bench: palette.orange500,
  deadlift: palette.teal400,
};
const INTENSITY_LABELS: Record<string, string> = {
  heavy: 'Heavy',
  explosive: 'Explosive',
  rep: 'Rep',
  deload: 'Deload',
};
const INTENSITY_FILTERS: IntensityFilter[] = [
  'all',
  'heavy',
  'explosive',
  'rep',
  'deload',
];
const CHART_TYPES: { key: ChartType; label: string; suffix: string }[] = [
  { key: '1rm', label: '1RM', suffix: ' kg' },
  { key: 'volume', label: 'Volume', suffix: ' kg' },
  { key: 'heaviest', label: 'Heaviest', suffix: ' kg' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

type ActualSet = { weight_grams?: number; reps_completed?: number };

function estimateBestOneRm(actualSets: unknown): number {
  if (!Array.isArray(actualSets) || actualSets.length === 0) return 0;
  let best = 0;
  for (const s of actualSets as ActualSet[]) {
    if (!s.weight_grams || !s.reps_completed || s.reps_completed <= 0 || s.reps_completed > 20) continue;
    const est = estimateOneRepMax_Epley(
      gramsToKg(s.weight_grams),
      s.reps_completed
    );
    if (est > best) best = est;
  }
  return best;
}

function computeSessionVolume(actualSets: unknown): number {
  if (!Array.isArray(actualSets) || actualSets.length === 0) return 0;
  let total = 0;
  for (const s of actualSets as ActualSet[]) {
    if (!s.weight_grams || !s.reps_completed || s.reps_completed <= 0) continue;
    total += gramsToKg(s.weight_grams) * s.reps_completed;
  }
  return total;
}

function computeHeaviestLift(actualSets: unknown): number {
  if (!Array.isArray(actualSets) || actualSets.length === 0) return 0;
  let heaviest = 0;
  for (const s of actualSets as ActualSet[]) {
    if (!s.weight_grams) continue;
    const kg = gramsToKg(s.weight_grams);
    if (kg > heaviest) heaviest = kg;
  }
  return heaviest;
}

function getSessionJoin(sessions: unknown): { intensity_type?: string } | null {
  if (!sessions) return null;
  return (Array.isArray(sessions) ? sessions[0] : sessions) as {
    intensity_type?: string;
  } | null;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function LiftHistoryScreen() {
  const { lift } = useLocalSearchParams<{ lift: string }>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const chartWidth = width - spacing[6] * 2 - spacing[4] * 2;

  const [intensityFilter, setIntensityFilter] =
    useState<IntensityFilter>('all');
  const [chartType, setChartType] = useState<ChartType>('1rm');

  const historyQuery = useQuery({
    queryKey: ['performance', 'lift', lift, user?.id],
    queryFn: () => getPerformanceByLift(user!.id, lift as Lift),
    enabled: !!user?.id && !!lift,
  });

  const trendsQuery = useQuery({
    queryKey: ['performance', 'trends', user?.id],
    queryFn: () => getPerformanceTrends(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const liftLabel = LIFT_LABELS[lift as Lift] ?? lift;
  const liftColor = LIFT_COLORS[lift as Lift] ?? palette.lime400;

  const currentOneRm = trendsQuery.data?.find(
    (t) => t.lift === lift
  )?.estimatedOneRmKg;

  const rows = historyQuery.data ?? [];

  // Session list filtered by intensity
  const filteredRows =
    intensityFilter === 'all'
      ? rows
      : rows.filter(
          (row) =>
            getSessionJoin(row.sessions)?.intensity_type === intensityFilter
        );

  // Build chart data from filteredRows (oldest → newest), responding to both
  // intensity filter and chart type
  const chartSourceRows = [...filteredRows].reverse();

  const getChartValue = (row: (typeof rows)[number]): number => {
    if (chartType === '1rm') return estimateBestOneRm(row.actual_sets);
    if (chartType === 'volume') return computeSessionVolume(row.actual_sets);
    return computeHeaviestLift(row.actual_sets);
  };

  const chartEntries = chartSourceRows
    .map((row) => ({ date: row.completed_at, value: getChartValue(row) }))
    .filter((e) => e.date && e.value > 0);

  const labelStep = Math.max(1, Math.ceil(chartEntries.length / 6));
  const activeChartDef = CHART_TYPES.find((c) => c.key === chartType)!;

  const chartData =
    chartEntries.length >= 1
      ? {
          labels: chartEntries.map((e, i) => {
            if (i % labelStep !== 0) return '';
            const d = new Date(e.date!);
            return `${d.getMonth() + 1}/${d.getDate()}`;
          }),
          datasets: [
            {
              data: chartEntries.map((e) => parseFloat(e.value.toFixed(1))),
              color: (opacity = 1) =>
                liftColor +
                Math.round(opacity * 255)
                  .toString(16)
                  .padStart(2, '0'),
              strokeWidth: 2,
            },
          ],
        }
      : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>← History</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.liftTitle}>{liftLabel}</Text>
          {currentOneRm != null && (
            <View style={styles.oneRmBadge}>
              <Text style={styles.oneRmBadgeText}>
                {currentOneRm.toFixed(1)} kg
              </Text>
            </View>
          )}
        </View>

        {/* Chart type tabs */}
        <View style={styles.chartTypeRow}>
          {CHART_TYPES.map((ct) => (
            <TouchableOpacity
              key={ct.key}
              style={[
                styles.chartTypeChip,
                chartType === ct.key && styles.chartTypeChipActive,
              ]}
              onPress={() => setChartType(ct.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chartTypeChipText,
                  chartType === ct.key && styles.chartTypeChipTextActive,
                ]}
              >
                {ct.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart */}
        {historyQuery.isLoading ? (
          <View style={styles.chartPlaceholder}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : chartData ? (
          <View style={styles.chartCard}>
            <LineChart
              data={chartData}
              width={chartWidth}
              height={180}
              withDots={true}
              withShadow={false}
              withInnerLines={true}
              withOuterLines={false}
              chartConfig={{
                backgroundGradientFrom: colors.bgSurface,
                backgroundGradientTo: colors.bgSurface,
                color: (opacity = 1) =>
                  liftColor +
                  Math.round(opacity * 255)
                    .toString(16)
                    .padStart(2, '0'),
                labelColor: () => colors.textTertiary,
                strokeWidth: 2,
                propsForDots: { r: '3', fill: liftColor, stroke: liftColor },
                propsForBackgroundLines: {
                  stroke: colors.border,
                  strokeDasharray: '',
                },
              }}
              style={{ borderRadius: radii.sm }}
              formatYLabel={(v) =>
                chartType === 'volume'
                  ? `${Math.round(Number(v))}`
                  : `${v}`
              }
              yAxisSuffix={activeChartDef.suffix}
            />
          </View>
        ) : (
          <Text style={styles.emptyText}>
            {rows.length === 0
              ? 'No sessions logged yet.'
              : filteredRows.length === 0
              ? 'No sessions match this filter.'
              : 'Not enough data to plot.'}
          </Text>
        )}

        {/* Intensity filter chips */}
        <Text style={styles.sectionHeader}>Sessions</Text>
        <View style={styles.filterRow}>
          {INTENSITY_FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterChip,
                intensityFilter === f && styles.filterChipActive,
              ]}
              onPress={() => setIntensityFilter(f)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  intensityFilter === f && styles.filterChipTextActive,
                ]}
              >
                {f === 'all' ? 'All' : INTENSITY_LABELS[f]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Session list */}
        {filteredRows.length > 0 ? (
          <View>
            {filteredRows.map((row) => {
              const sess = getSessionJoin(row.sessions);
              const intensityName =
                INTENSITY_LABELS[sess?.intensity_type ?? ''] ??
                sess?.intensity_type ??
                '—';
              const oneRm = estimateBestOneRm(row.actual_sets);
              return (
                <View key={row.id} style={styles.sessionRow}>
                  <View style={styles.sessionLeft}>
                    <Text style={styles.sessionDate}>
                      {formatDate(row.completed_at ?? '')}
                      {row.completed_at && formatTime(row.completed_at)
                        ? ` · ${formatTime(row.completed_at)}`
                        : ''}
                    </Text>
                    <View style={styles.intensityBadge}>
                      <Text style={styles.intensityBadgeText}>
                        {intensityName}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.sessionRight}>
                    {oneRm > 0 && (
                      <Text style={styles.sessionOneRm}>
                        {oneRm.toFixed(1)} kg
                      </Text>
                    )}
                    {row.session_rpe != null && (
                      <Text style={styles.sessionRpe}>
                        RPE {row.session_rpe}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.emptyText}>No sessions match this filter.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  scrollView: { flex: 1 },
  container: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
  },
  backButton: { marginBottom: spacing[4] },
  backText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  liftTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.black,
    color: colors.text,
    letterSpacing: typography.letterSpacing.tight,
  },
  oneRmBadge: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderWidth: 1,
    borderColor: colors.primary,
  },
  oneRmBadgeText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  // Chart type selector
  chartTypeRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  chartTypeChip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: spacing[2],
    backgroundColor: colors.bgSurface,
  },
  chartTypeChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  chartTypeChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  chartTypeChipTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
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
  chartCard: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing[4],
    marginBottom: spacing[6],
  },
  chartPlaceholder: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    borderRadius: radii.md,
    marginBottom: spacing[6],
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Intensity filter chips
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
  sessionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
  },
  sessionDate: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  intensityBadge: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.xs,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  intensityBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  sessionRight: { alignItems: 'flex-end', gap: spacing[0.5] },
  sessionOneRm: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  sessionRpe: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.textTertiary,
    marginBottom: spacing[8],
  },
});
