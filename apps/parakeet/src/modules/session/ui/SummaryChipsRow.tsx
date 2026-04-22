// @spec docs/features/session/spec-completion.md
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { getPerformanceColors, PERFORMANCE_LABELS } from './performance-styles';

export function SummaryChipsRow({
  sessionRpe,
  completionPct,
  performanceVsPlan,
  colors,
}: {
  sessionRpe: number | null;
  completionPct: number | null;
  performanceVsPlan: string | null;
  colors: ColorScheme;
}) {
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const performanceColors = useMemo(
    () => getPerformanceColors(colors),
    [colors]
  );

  const hasAny =
    sessionRpe != null || completionPct != null || performanceVsPlan;
  if (!hasAny) return null;

  return (
    <View style={styles.summaryRow}>
      {sessionRpe != null && (
        <View style={styles.summaryChip}>
          <Text style={styles.summaryChipLabel}>RPE</Text>
          <Text style={styles.summaryChipValue}>{sessionRpe}</Text>
        </View>
      )}
      {completionPct != null && (
        <View style={styles.summaryChip}>
          <Text style={styles.summaryChipLabel}>Completion</Text>
          <Text style={styles.summaryChipValue}>
            {Math.round(completionPct)}%
          </Text>
        </View>
      )}
      {performanceVsPlan && (
        <View style={styles.summaryChip}>
          <Text style={styles.summaryChipLabel}>Performance</Text>
          <Text
            style={[
              styles.summaryChipValue,
              {
                color: performanceColors[performanceVsPlan] ?? colors.text,
              },
            ]}
          >
            {PERFORMANCE_LABELS[performanceVsPlan] ?? performanceVsPlan}
          </Text>
        </View>
      )}
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
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
  });
}
