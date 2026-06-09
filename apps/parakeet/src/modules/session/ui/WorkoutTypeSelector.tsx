// @spec docs/features/session/spec-workout-type-swap.md
import type { Lift } from '@parakeet/shared-types';
import { capitalize } from '@shared/utils/string';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

export interface WorkoutTypeSelectorProps {
  /** Lifts the user can choose from (program lifts — squat/bench/deadlift). */
  lifts: readonly Lift[];
  /** Currently-selected lift (the session's `primary_lift`). */
  selected: Lift;
  /** The lift the rotation originally prescribed — marked "Recommended". */
  recommended: Lift;
  /** Auto-recomputed intensity for the selected lift, shown as a read-only note. */
  intensityType: string;
  /** Disables interaction while a swap is in flight. */
  disabled?: boolean;
  onSelect: (lift: Lift) => void;
}

/**
 * First-screen control on the generate flow: lets the lifter swap which lift
 * they train today ("squat instead of the planned bench"). The recommended
 * lift is pre-selected and tagged; intensity is recomputed automatically for
 * whatever lift is chosen, so it's shown read-only. Unending programs only.
 */
export function WorkoutTypeSelector({
  lifts,
  selected,
  recommended,
  intensityType,
  disabled = false,
  onSelect,
}: WorkoutTypeSelectorProps) {
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          gap: spacing[2],
        },
        title: {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.semibold,
          color: colors.textSecondary,
        },
        chipRow: {
          flexDirection: 'row',
          gap: spacing[2],
        },
        chip: {
          flex: 1,
          paddingVertical: spacing[2.5],
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bgSurface,
          alignItems: 'center',
        },
        chipSelected: {
          borderColor: colors.primary,
          backgroundColor: colors.primaryMuted,
        },
        chipDisabled: {
          opacity: 0.5,
        },
        chipLabel: {
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.semibold,
          color: colors.text,
        },
        recommendedTag: {
          marginTop: 2,
          fontSize: typography.sizes.xs,
          color: colors.textTertiary,
        },
        intensityNote: {
          fontSize: typography.sizes.xs,
          color: colors.textTertiary,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>Today's workout</Text>
      <View style={styles.chipRow}>
        {lifts.map((lift) => {
          const isSelected = lift === selected;
          return (
            <TouchableOpacity
              key={lift}
              style={[
                styles.chip,
                isSelected && styles.chipSelected,
                disabled && styles.chipDisabled,
              ]}
              onPress={() => !disabled && !isSelected && onSelect(lift)}
              activeOpacity={0.7}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={`${capitalize(lift)}${
                lift === recommended ? ', recommended' : ''
              }`}
            >
              <Text style={styles.chipLabel}>{capitalize(lift)}</Text>
              {lift === recommended && (
                <Text style={styles.recommendedTag}>Recommended</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.intensityNote}>
        Intensity: {capitalize(intensityType)} (auto)
      </Text>
    </View>
  );
}
