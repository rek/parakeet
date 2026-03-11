import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '../../theme';
import type { ColorScheme } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

interface BlockBadgeProps {
  block: number | null;
}

interface BadgeConfig {
  bg: string;
  text: string;
  label: string;
}

function getBadgeConfig(
  block: number | null,
  colors: ColorScheme
): BadgeConfig {
  switch (block) {
    case 1:
      return { bg: colors.infoMuted, text: colors.info, label: 'B1' };
    case 2:
      return { bg: colors.secondaryMuted, text: colors.secondary, label: 'B2' };
    case 3:
      return { bg: colors.dangerMuted, text: colors.danger, label: 'B3' };
    default:
      return { bg: colors.bgMuted, text: colors.textSecondary, label: 'DL' };
  }
}

export function BlockBadge({ block }: BlockBadgeProps) {
  const { colors } = useTheme();
  const config = getBadgeConfig(block, colors);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        badge: {
          borderRadius: radii.xs,
          paddingHorizontal: spacing[2],
          paddingVertical: spacing[0.5],
        },
        label: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.bold,
          letterSpacing: typography.letterSpacing.wide,
        },
      }),
    []
  );

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.label, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}
