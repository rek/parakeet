import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { radii, spacing, typography } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

interface PostRestOverlayProps {
  plannedReps: number;
  onLiftComplete: () => void;
  onReset15s: () => void;
  resetCountdown: number | null;
}

export function PostRestOverlay({
  plannedReps,
  onLiftComplete,
  onReset15s,
  resetCountdown,
}: PostRestOverlayProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.bgElevated,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing[5],
      paddingBottom: spacing[5],
      paddingTop: spacing[4],
      alignItems: 'center',
      width: '100%',
      maxWidth: 560,
      gap: spacing[3],
    },
    label: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wider,
    },
    liftButton: {
      width: '100%',
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: spacing[3.5],
      alignItems: 'center',
    },
    liftButtonText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: colors.textInverse,
      letterSpacing: typography.letterSpacing.wide,
    },
    resetButton: {
      width: '100%',
      backgroundColor: colors.bgMuted,
      borderRadius: radii.md,
      paddingVertical: spacing[2.5],
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    resetButtonText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
    hintText: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
    },
  }), [colors]);

  const resetLabel = resetCountdown !== null
    ? `${resetCountdown}s…`
    : 'Reset 15s';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Go lift!</Text>

      <TouchableOpacity
        style={styles.liftButton}
        onPress={onLiftComplete}
        activeOpacity={0.8}
      >
        <Text style={styles.liftButtonText}>Lift complete</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.resetButton}
        onPress={onReset15s}
        activeOpacity={0.7}
      >
        <Text style={styles.resetButtonText}>{resetLabel}</Text>
      </TouchableOpacity>

      {plannedReps > 0 && (
        <Text style={styles.hintText}>
          ~{2 * plannedReps}s estimated lift time
        </Text>
      )}
    </View>
  );
}
