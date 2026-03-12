import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StreakPillProps {
  currentStreak: number;
  onPress?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StreakPill({ currentStreak, onPress }: StreakPillProps) {
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pill: {
          backgroundColor: colors.secondaryMuted,
          borderRadius: radii.full,
          borderWidth: 1,
          borderColor: colors.secondary,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[1],
          alignSelf: 'flex-start',
        },
        text: {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.bold,
          color: colors.secondary,
        },
      }),
    [colors]
  );

  if (currentStreak < 1) return null;

  return (
    <TouchableOpacity
      style={styles.pill}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <Text style={styles.text}>🔥 {currentStreak} wk</Text>
    </TouchableOpacity>
  );
}
