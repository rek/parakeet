import { StyleSheet, Text, View } from 'react-native';

import type { RepAnalysis, RepVerdict } from '@parakeet/shared-types';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { VerdictBadge } from './VerdictBadge';

function severityColor(
  severity: 'info' | 'warning' | 'critical',
  colors: ColorScheme
) {
  if (severity === 'info') return colors.info;
  if (severity === 'warning') return colors.warning;
  return colors.danger;
}

/**
 * Displays per-rep metrics and form faults for a single rep of a lift.
 *
 * Renders a card with depth, lean, bar drift, ROM values and any detected
 * form faults. Used in the video analysis screen to show analysis results.
 */
export function RepMetricsCard({
  rep,
  lift,
  colors,
  verdict,
}: {
  rep: RepAnalysis;
  lift: string;
  colors: ColorScheme;
  verdict?: RepVerdict | null;
}) {
  const styles = buildStyles(colors);

  const hasMetrics =
    rep.maxDepthCm != null ||
    rep.forwardLeanDeg != null ||
    rep.barDriftCm != null ||
    rep.romCm != null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.repLabel}>Rep {rep.repNumber}</Text>
        {verdict && <VerdictBadge verdict={verdict} colors={colors} inline />}
      </View>

      {hasMetrics && (
        <View style={styles.metricsBlock}>
          {rep.maxDepthCm != null && lift === 'squat' && (
            <MetricRow
              label="Depth"
              value={
                rep.maxDepthCm > 0
                  ? `${rep.maxDepthCm.toFixed(1)} cm below parallel ✓`
                  : `${Math.abs(rep.maxDepthCm).toFixed(1)} cm above parallel`
              }
              isGood={rep.maxDepthCm > 0}
              styles={styles}
            />
          )}
          {rep.forwardLeanDeg != null && (
            <MetricRow
              label="Forward lean"
              value={`${rep.forwardLeanDeg.toFixed(0)}°`}
              isGood={rep.forwardLeanDeg <= 55}
              styles={styles}
            />
          )}
          {rep.barDriftCm != null && (
            <MetricRow
              label="Bar drift"
              value={`${rep.barDriftCm.toFixed(1)} cm`}
              isGood={rep.barDriftCm <= 5}
              styles={styles}
            />
          )}
          {rep.romCm != null && (
            <MetricRow
              label="ROM"
              value={`${rep.romCm.toFixed(0)} cm`}
              styles={styles}
            />
          )}
        </View>
      )}

      <View style={styles.faultsBlock}>
        {rep.faults.length === 0 ? (
          <Text style={styles.faultsNone}>No faults detected</Text>
        ) : (
          rep.faults.map((fault, i) => (
            <View key={i} style={styles.faultRow}>
              <View
                style={[
                  styles.faultDot,
                  {
                    backgroundColor: severityColor(fault.severity, colors),
                  },
                ]}
              />
              <Text style={styles.faultMessage}>{fault.message}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function MetricRow({
  label,
  value,
  isGood,
  styles,
}: {
  label: string;
  value: string;
  isGood?: boolean;
  styles: ReturnType<typeof buildStyles>;
}) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        style={[
          styles.metricValue,
          isGood === true && styles.metricValueGood,
          isGood === false && styles.metricValueBad,
        ]}
      >
        {value}
      </Text>
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
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing[3],
    },
    repLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.bold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wider,
    },
    metricsBlock: {
      marginBottom: spacing[3],
      gap: spacing[1.5],
    },
    metricRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    metricLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    metricValue: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.text,
    },
    metricValueGood: {
      color: colors.success,
    },
    metricValueBad: {
      color: colors.warning,
    },
    faultsBlock: {
      gap: spacing[1.5],
    },
    faultsNone: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
    faultRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing[2],
    },
    faultDot: {
      width: 6,
      height: 6,
      borderRadius: radii.full,
      marginTop: 5,
      flexShrink: 0,
    },
    faultMessage: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.text,
      lineHeight: 18,
    },
  });
}
