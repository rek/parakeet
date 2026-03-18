import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFeatureEnabled } from '@modules/feature-flags';
import {
  getActualVsPlannedColor,
  getPerformanceColors,
  getSession,
  getSessionLog,
  parseJitInputSnapshot,
  parsePlannedSetsJson,
  parsePrescriptionTrace,
  PERFORMANCE_LABELS,
  PrescriptionSheet,
  SessionContextCard,
} from '@modules/session';
import type { Lift } from '@parakeet/shared-types';
import { gramsToKg } from '@parakeet/training-engine';
import { qk } from '@platform/query';
import { LIFT_LABELS } from '@shared/constants';
import { formatDate, formatTime } from '@shared/utils/date';
import { capitalize } from '@shared/utils/string';

import { BackLink } from '../../components/navigation/BackLink';
import { radii, spacing, typography } from '../../theme';
import type { ColorScheme } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtKg(kg: number): string {
  return kg % 1 === 0 ? `${kg}` : kg.toFixed(1);
}

const ACTUAL_VS_PLANNED_COLORS = {
  neutral: 'text',
  under: 'warning',
  over: 'success',
} as const;

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: spacing[4], paddingTop: spacing[2] },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: spacing[12],
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
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
    tableCellPlan: { flex: 1, color: colors.textSecondary },
    tableCellActual: { flex: 1 },
    tableCellRpe: {
      width: 48,
      textAlign: 'right',
      color: colors.textSecondary,
    },
    emptyText: {
      fontSize: typography.sizes.base,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: spacing[8],
    },
    traceButton: {
      marginTop: spacing[4],
      paddingVertical: spacing[3],
      paddingHorizontal: spacing[4],
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgMuted,
      alignItems: 'center',
    },
    traceButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.textSecondary,
    },
  });
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function SessionDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const performanceColors = useMemo(
    () => getPerformanceColors(colors),
    [colors]
  );
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [traceSheetVisible, setTraceSheetVisible] = useState(false);
  const traceEnabled = useFeatureEnabled('prescriptionTrace');

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: qk.session.detail(sessionId),
    queryFn: () => getSession(sessionId),
    enabled: !!sessionId,
  });

  const { data: log, isLoading: logLoading } = useQuery({
    queryKey: qk.session.log(sessionId),
    queryFn: () => getSessionLog(sessionId),
    enabled: !!sessionId,
  });

  const isLoading = sessionLoading || logLoading;

  const jitSnapshot = useMemo(
    () => parseJitInputSnapshot(session?.jit_input_snapshot),
    [session?.jit_input_snapshot]
  );

  const prescriptionTrace = useMemo(
    () => parsePrescriptionTrace(session?.jit_output_trace),
    [session?.jit_output_trace]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <BackLink onPress={() => router.back()} />
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>Session not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const liftLabel =
    LIFT_LABELS[session.primary_lift as Lift] ??
    capitalize(session.primary_lift ?? '');
  const intensityLabel = capitalize(session.intensity_type ?? '');
  const completedAt = session.completed_at ?? null;
  const dateLabel = formatDate(completedAt ?? session.planned_date);
  const timeLabel = completedAt ? formatTime(completedAt) : '';

  const mainSets = log?.actual_sets ?? [];
  const auxSets = log?.auxiliary_sets ?? [];

  const plannedSets = parsePlannedSetsJson(session.planned_sets);
  const plannedBySet = new Map(plannedSets.map((ps) => [ps.set_number, ps]));
  const hasPlan = plannedSets.length > 0;

  // Group auxiliary sets by exercise name
  const auxByExercise = auxSets.reduce<Record<string, typeof auxSets>>(
    (acc, set) => {
      const name = set.exercise ?? 'Auxiliary';
      if (!acc[name]) acc[name] = [];
      acc[name].push(set);
      return acc;
    },
    {}
  );

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
        <Text style={styles.title}>
          {liftLabel} — {intensityLabel}
        </Text>
        <Text style={styles.subtitle}>
          Week {session.week_number}
          {session.block_number
            ? ` · Block ${session.block_number}`
            : ''} · {dateLabel}
          {timeLabel ? ` · ${timeLabel}` : ''}
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
                <Text style={styles.summaryChipValue}>
                  {Math.round(log.completion_pct)}%
                </Text>
              </View>
            )}
            {log.performance_vs_plan && (
              <View style={styles.summaryChip}>
                <Text style={styles.summaryChipLabel}>Performance</Text>
                <Text
                  style={[
                    styles.summaryChipValue,
                    {
                      color:
                        performanceColors[log.performance_vs_plan] ??
                        colors.text,
                    },
                  ]}
                >
                  {PERFORMANCE_LABELS[log.performance_vs_plan] ??
                    log.performance_vs_plan}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Session context — soreness, readiness, disruptions at session time */}
        {jitSnapshot && (
          <SessionContextCard
            sorenessRatings={jitSnapshot.sorenessRatings}
            sleepQuality={jitSnapshot.sleepQuality}
            energyLevel={jitSnapshot.energyLevel}
            activeDisruptions={jitSnapshot.activeDisruptions}
            colors={colors}
          />
        )}

        {/* Main lift sets */}
        {mainSets.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Main Lift</Text>
            <View style={styles.setsTable}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.tableCellSet]}>Set</Text>
                {hasPlan ? (
                  <>
                    <Text style={[styles.tableCell, styles.tableCellPlan]}>
                      Plan
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellActual]}>
                      Actual
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.tableCell, styles.tableCellWeight]}>
                      Weight
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellReps]}>
                      Reps
                    </Text>
                  </>
                )}
                <Text style={[styles.tableCell, styles.tableCellRpe]}>RPE</Text>
              </View>
              {mainSets.map((set, i) => {
                const planned = hasPlan
                  ? plannedBySet.get(set.set_number)
                  : undefined;
                const result = getActualVsPlannedColor({ actual: set, planned });
                const actualColor = colors[ACTUAL_VS_PLANNED_COLORS[result]];
                return (
                  <View
                    key={i}
                    style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}
                  >
                    <Text style={[styles.tableCell, styles.tableCellSet]}>
                      {set.set_number}
                    </Text>
                    {hasPlan ? (
                      <>
                        <Text style={[styles.tableCell, styles.tableCellPlan]}>
                          {planned
                            ? `${fmtKg(planned.weight_kg)}×${planned.reps}`
                            : '—'}
                        </Text>
                        <Text
                          style={[
                            styles.tableCell,
                            styles.tableCellActual,
                            { color: actualColor },
                          ]}
                        >
                          {`${fmtKg(gramsToKg(set.weight_grams))}×${set.reps_completed}`}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={[styles.tableCell, styles.tableCellWeight]}>
                          {gramsToKg(set.weight_grams).toFixed(1)} kg
                        </Text>
                        <Text style={[styles.tableCell, styles.tableCellReps]}>
                          {set.reps_completed}
                        </Text>
                      </>
                    )}
                    <Text style={[styles.tableCell, styles.tableCellRpe]}>
                      {set.rpe_actual != null ? set.rpe_actual : '—'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Auxiliary sets */}
        {Object.entries(auxByExercise).map(([exercise, sets]) => (
          <View key={exercise}>
            <Text style={styles.sectionHeader}>
              {capitalize(exercise.replace(/_/g, ' '))}
            </Text>
            <View style={styles.setsTable}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.tableCellSet]}>Set</Text>
                <Text style={[styles.tableCell, styles.tableCellWeight]}>
                  Weight
                </Text>
                <Text style={[styles.tableCell, styles.tableCellReps]}>
                  Reps
                </Text>
                <Text style={[styles.tableCell, styles.tableCellRpe]}>RPE</Text>
              </View>
              {sets.map((set, i) => (
                <View
                  key={i}
                  style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}
                >
                  <Text style={[styles.tableCell, styles.tableCellSet]}>
                    {set.set_number}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellWeight]}>
                    {gramsToKg(set.weight_grams).toFixed(1)} kg
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellReps]}>
                    {set.reps_completed}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellRpe]}>
                    {set.rpe_actual != null ? set.rpe_actual : '—'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {!log && (
          <Text style={styles.emptyText}>
            No set data recorded for this session.
          </Text>
        )}

        {prescriptionTrace && traceEnabled && (
          <TouchableOpacity
            style={styles.traceButton}
            onPress={() => setTraceSheetVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.traceButtonText}>Workout Reasoning</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {prescriptionTrace && traceEnabled && (
        <PrescriptionSheet
          visible={traceSheetVisible}
          onClose={() => setTraceSheetVisible(false)}
          trace={prescriptionTrace}
        />
      )}
    </SafeAreaView>
  );
}
