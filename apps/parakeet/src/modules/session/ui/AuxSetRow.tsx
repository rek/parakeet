// @spec docs/features/session/spec-skip-aux-set.md
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

export interface AuxSetRowProps {
  setNumber: number;
  exerciseType?: 'weighted' | 'bodyweight' | 'timed';
  /** Completed sets cannot be skipped — the skip affordance is hidden. */
  isCompleted: boolean;
  /** When true, the row renders the greyed "Skipped" state with a restore
   *  control instead of `children`. */
  isSkipped: boolean;
  onSkip: () => void;
  onRestore: () => void;
  /** The SetRow rendered when the set is active (not skipped). */
  children: ReactNode;
}

/**
 * Wraps an auxiliary {@link SetRow} with a per-set skip affordance. Tapping the
 * `×` marks a planned set as skipped (machine busy / out of time / opted out);
 * the row then greys out to "Set N — Skipped" with a restore control. Skip is
 * only offered on incomplete sets and is fully reversible. Ad-hoc sets keep
 * their own hard-delete control and don't use this component.
 */
export function AuxSetRow({
  setNumber,
  exerciseType = 'weighted',
  isCompleted,
  isSkipped,
  onSkip,
  onRestore,
  children,
}: AuxSetRowProps) {
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        content: {
          flex: 1,
        },
        iconButton: {
          paddingHorizontal: 6,
          paddingVertical: 4,
        },
        skippedRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2.5],
          borderBottomWidth: 1,
          borderBottomColor: colors.borderMuted,
        },
        skippedLabel: {
          flex: 1,
          fontSize: typography.sizes.sm,
          color: colors.textTertiary,
          fontStyle: 'italic',
        },
        restoreText: {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.semibold,
          color: colors.primary,
        },
      }),
    [colors]
  );

  const label = `${exerciseType === 'timed' ? 'Round' : 'Set'} ${setNumber}`;

  if (isSkipped) {
    return (
      <View style={styles.skippedRow}>
        <Text style={styles.skippedLabel}>{label} — Skipped</Text>
        <TouchableOpacity
          onPress={onRestore}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Restore ${label}`}
          accessibilityRole="button"
        >
          <Text style={styles.restoreText}>↺ Restore</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.content}>{children}</View>
      {!isCompleted && (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onSkip}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
          accessibilityLabel={`Skip ${label}`}
          accessibilityRole="button"
        >
          <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
}
