// @spec docs/features/rest-timer/spec-timer-ui.md
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { fmtKg } from '../utils/fmtKg';

interface PostRestOverlayProps {
  plannedReps: number;
  plannedWeightKg?: number | null;
  nextSetNumber?: number | null;
  /** Human-formatted exercise name (e.g. "Barbell Row"). When provided, shown as part of context label. */
  exerciseName?: string;
  onLiftComplete: () => void;
  onLiftFailed: (reps: number) => void;
  onReset15s: () => void;
  resetCountdown: number | null;
  /** When true, hides rest controls ("+15s", "Go lift!", estimated time) — used for first-set confirmation */
  isConfirmation?: boolean;
  /** Slot for optional recording button, rendered between context label and action buttons */
  recordingSlot?: ReactNode;
}

export function PostRestOverlay({
  plannedReps,
  plannedWeightKg,
  nextSetNumber,
  exerciseName,
  onLiftComplete,
  onLiftFailed,
  onReset15s,
  resetCountdown,
  isConfirmation = false,
  recordingSlot,
}: PostRestOverlayProps) {
  const { colors } = useTheme();
  const [failedReps, setFailedReps] = useState<number | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
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
        buttonRow: {
          flexDirection: 'row',
          gap: spacing[2.5],
          width: '100%',
        },
        liftButton: {
          flex: 1,
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
        failedButton: {
          flex: 1,
          backgroundColor: colors.bgMuted,
          borderRadius: radii.md,
          paddingVertical: spacing[3.5],
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
        },
        failedButtonText: {
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.semibold,
          color: colors.textSecondary,
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
        contextText: {
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.semibold,
          color: colors.text,
        },
        hintText: {
          fontSize: typography.sizes.xs,
          color: colors.textTertiary,
        },
        // Failed-mode styles
        stepperRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[4],
        },
        stepBtn: {
          width: 40,
          height: 40,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bgMuted,
          alignItems: 'center',
          justifyContent: 'center',
        },
        stepBtnDisabled: {
          opacity: 0.35,
        },
        stepBtnText: {
          fontSize: typography.sizes.lg,
          fontWeight: typography.weights.semibold,
          color: colors.text,
        },
        stepperValue: {
          fontSize: typography.sizes['2xl'],
          fontWeight: typography.weights.bold,
          color: colors.text,
          minWidth: 36,
          textAlign: 'center',
        },
        confirmButton: {
          width: '100%',
          backgroundColor: colors.primary,
          borderRadius: radii.md,
          paddingVertical: spacing[3.5],
          alignItems: 'center',
        },
        confirmButtonText: {
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.bold,
          color: colors.textInverse,
          letterSpacing: typography.letterSpacing.wide,
        },
        backButton: {
          paddingVertical: spacing[1],
        },
        backButtonText: {
          fontSize: typography.sizes.sm,
          color: colors.textTertiary,
        },
      }),
    [colors]
  );

  const resetLabel =
    resetCountdown !== null ? `+15s (${resetCountdown}s)` : '+15s rest';

  const contextLabel = (() => {
    if (plannedReps <= 0) return null;
    const weightPart = plannedWeightKg
      ? `${fmtKg(plannedWeightKg)}kg × ${plannedReps}`
      : `× ${plannedReps}`;
    if (exerciseName && nextSetNumber != null) {
      return `${exerciseName} Set ${nextSetNumber} — ${weightPart}`;
    }
    if (exerciseName) {
      return `${exerciseName} — ${weightPart}`;
    }
    if (nextSetNumber != null) {
      return `Set ${nextSetNumber} — ${weightPart}`;
    }
    return null;
  })();

  if (failedReps !== null) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>How many reps?</Text>
        {recordingSlot}

        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={[styles.stepBtn, failedReps <= 0 && styles.stepBtnDisabled]}
            onPress={() => setFailedReps((r) => Math.max(0, (r ?? 0) - 1))}
            disabled={failedReps <= 0}
            activeOpacity={0.7}
          >
            <Text style={styles.stepBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{failedReps}</Text>
          <TouchableOpacity
            style={[
              styles.stepBtn,
              failedReps >= plannedReps && styles.stepBtnDisabled,
            ]}
            onPress={() =>
              setFailedReps((r) => Math.min(plannedReps, (r ?? 0) + 1))
            }
            disabled={failedReps >= plannedReps}
            activeOpacity={0.7}
          >
            <Text style={styles.stepBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.confirmButton}
          onPress={() => {
            onLiftFailed(failedReps);
            setFailedReps(null);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmButtonText}>Confirm</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setFailedReps(null)}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {contextLabel != null && (
        <Text style={styles.contextText}>{contextLabel}</Text>
      )}
      {recordingSlot}
      {!isConfirmation && <Text style={styles.label}>Go lift!</Text>}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.liftButton}
          onPress={onLiftComplete}
          activeOpacity={0.8}
        >
          <Text style={styles.liftButtonText}>Complete</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.failedButton}
          onPress={() => setFailedReps(plannedReps)}
          activeOpacity={0.7}
        >
          <Text style={styles.failedButtonText}>Failed</Text>
        </TouchableOpacity>
      </View>

      {!isConfirmation && (
        <>
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
        </>
      )}
    </View>
  );
}
