import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import type { ReadinessScore } from '../lib/readiness-score';

const TREND_CONFIG = {
  improving: { symbol: '\u2191', label: 'Improving' },
  stable: { symbol: '\u2192', label: 'Stable' },
  declining: { symbol: '\u2193', label: 'Declining' },
} as const;

function readinessColor(passRate: number, colors: ColorScheme) {
  if (passRate >= 0.9) return colors.success;
  if (passRate >= 0.7) return colors.warning;
  return colors.danger;
}

function trendColor(trend: ReadinessScore['trend'], colors: ColorScheme) {
  if (trend === 'improving') return colors.success;
  if (trend === 'declining') return colors.danger;
  return colors.textSecondary;
}

/**
 * Competition readiness card showing aggregate pass rate across recent videos.
 * Displays pass rate percentage, trend, and most common failure.
 */
export function ReadinessCard({
  score,
  lift: _lift,
  colors,
}: {
  score: ReadinessScore;
  lift: string;
  colors: ColorScheme;
}) {
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const pct = Math.round(score.passRate * 100);
  const color = readinessColor(score.passRate, colors);
  const trend = TREND_CONFIG[score.trend];
  const tc = trendColor(score.trend, colors);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>Competition Readiness</Text>

      <View style={styles.mainRow}>
        <Text style={[styles.percentage, { color }]}>{pct}%</Text>
        <View style={styles.details}>
          <Text style={styles.subtitle}>
            {score.passedReps}/{score.totalReps} reps pass IPF standards
          </Text>
          <View style={styles.trendRow}>
            <Text style={[styles.trendSymbol, { color: tc }]}>
              {trend.symbol}
            </Text>
            <Text style={[styles.trendLabel, { color: tc }]}>
              {trend.label}
            </Text>
          </View>
          <Text style={styles.windowLabel}>
            Based on last {score.window} session{score.window !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Breakdown */}
      <View style={styles.breakdownRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {score.passedReps}
          </Text>
          <Text style={styles.statLabel}>Pass</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.warning }]}>
            {score.borderlineReps}
          </Text>
          <Text style={styles.statLabel}>Borderline</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.danger }]}>
            {score.failedReps}
          </Text>
          <Text style={styles.statLabel}>Fail</Text>
        </View>
      </View>

      {/* Most common failure */}
      {score.mostCommonFailure && (
        <View style={styles.failureCallout}>
          <Text style={styles.failureLabel}>Most common issue</Text>
          <Text style={styles.failureName}>
            {score.mostCommonFailure.replace(/_/g, ' ')}
          </Text>
        </View>
      )}
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[4],
      marginBottom: spacing[3],
    },
    sectionLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.widest,
      marginBottom: spacing[3],
    },
    mainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[4],
      marginBottom: spacing[3],
    },
    percentage: {
      fontSize: 40,
      fontWeight: typography.weights.black,
    },
    details: {
      flex: 1,
    },
    subtitle: {
      fontSize: typography.sizes.sm,
      color: colors.text,
      marginBottom: spacing[1],
    },
    trendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
    },
    trendSymbol: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold,
    },
    trendLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
    },
    windowLabel: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      marginTop: spacing[1],
    },
    breakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: spacing[3],
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginBottom: spacing[2],
    },
    stat: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
    },
    statLabel: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
    },
    failureCallout: {
      backgroundColor: colors.bgMuted,
      borderRadius: radii.sm,
      padding: spacing[3],
      marginTop: spacing[2],
    },
    failureLabel: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      marginBottom: spacing[1],
    },
    failureName: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.danger,
      textTransform: 'capitalize',
    },
  });
}
