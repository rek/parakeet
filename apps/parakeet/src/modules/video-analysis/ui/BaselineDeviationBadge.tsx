import { StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import type { BaselineDeviation } from '../lib/personal-baseline';

const DIRECTION_CONFIG = {
  better: { symbol: '↑', label: 'Improved' },
  worse: { symbol: '↓', label: 'Regressed' },
  neutral: { symbol: '→', label: 'Changed' },
} as const;

/**
 * Compact badge showing how a rep metric deviates from the lifter's personal baseline.
 * Green for improvement, red for regression. Only rendered when deviation exceeds threshold.
 */
export function BaselineDeviationBadge({
  deviation,
  colors,
}: {
  deviation: BaselineDeviation;
  colors: ColorScheme;
}) {
  const config = DIRECTION_CONFIG[deviation.direction];
  const badgeColor =
    deviation.direction === 'better'
      ? colors.success
      : deviation.direction === 'worse'
        ? colors.danger
        : colors.warning;

  return (
    <View style={[styles.badge, { borderColor: badgeColor + '40' }]}>
      <Text style={[styles.symbol, { color: badgeColor }]}>
        {config.symbol}
      </Text>
      <View style={styles.textBlock}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {deviation.label}
        </Text>
        <Text style={[styles.detail, { color: badgeColor }]}>
          {config.label} vs baseline ({deviation.baselineValue.toFixed(1)})
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    marginTop: spacing[1],
  },
  symbol: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  textBlock: {
    flex: 1,
  },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  detail: {
    fontSize: typography.sizes.xs,
  },
});
