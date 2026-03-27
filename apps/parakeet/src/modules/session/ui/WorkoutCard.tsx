import { useMemo, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { formatDate } from '@shared/utils/date';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { getSession } from '../application/session.service';

// ── Types ────────────────────────────────────────────────────────────────────

type Session = Awaited<ReturnType<typeof getSession>>;

interface WorkoutCardProps {
  session: NonNullable<Session>;
  onStart: (sessionId: string) => void;
  onResume: (sessionId: string) => void;
  onSkip: (sessionId: string, reason?: string) => Promise<void>;
  onSkipComplete?: () => void;
  isLocked?: boolean;
}

function getIntensityBadge(intensityType: string, colors: ColorScheme) {
  const map: Record<string, { bg: string; text: string }> = {
    heavy: { bg: colors.danger, text: colors.text },
    explosive: { bg: colors.primary, text: colors.textInverse },
    rep: { bg: colors.success, text: colors.textInverse },
  };
  return (
    map[intensityType.toLowerCase()] ?? {
      bg: colors.bgMuted,
      text: colors.textSecondary,
    }
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[5],
      marginHorizontal: spacing[4],
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing[1.5],
    },
    liftName: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.black,
      color: colors.text,
      flex: 1,
      marginRight: spacing[2],
      letterSpacing: typography.letterSpacing.tight,
    },
    intensityBadge: {
      borderRadius: radii.sm,
      paddingHorizontal: spacing[2.5],
      paddingVertical: spacing[1],
    },
    intensityBadgeText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      letterSpacing: typography.letterSpacing.wide,
      textTransform: 'uppercase',
    },
    blockWeekText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginBottom: spacing[2],
    },
    noSetsText: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
      fontStyle: 'italic',
      marginBottom: spacing[1.5],
    },
    setsText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginBottom: spacing[1.5],
    },
    dateText: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
      marginBottom: spacing[5],
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing[2.5],
    },
    button: {
      flex: 1,
      borderRadius: radii.md,
      paddingVertical: spacing[3.5],
      alignItems: 'center',
    },
    startButton: {
      backgroundColor: colors.primary,
    },
    startButtonLocked: {
      backgroundColor: colors.bgMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    startButtonText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: colors.textInverse,
      letterSpacing: typography.letterSpacing.wide,
    },
    startButtonTextLocked: {
      color: colors.textTertiary,
      fontWeight: typography.weights.medium,
    },
    skipButton: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgMuted,
    },
    skipButtonText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
    // Modal
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: colors.bgElevated,
      borderTopLeftRadius: radii['2xl'],
      borderTopRightRadius: radii['2xl'],
      borderTopWidth: 1,
      borderColor: colors.border,
      padding: spacing[6],
      paddingBottom: spacing[10],
    },
    modalTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.text,
      marginBottom: spacing[4],
    },
    modalInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing[3],
      fontSize: typography.sizes.base,
      color: colors.text,
      backgroundColor: colors.bgSurface,
      marginBottom: spacing[4],
      minHeight: 72,
    },
    modalButton: {
      borderRadius: radii.md,
      paddingVertical: spacing[3.5],
      alignItems: 'center',
      marginBottom: spacing[2.5],
    },
    modalButtonDisabled: {
      opacity: 0.5,
    },
    skipConfirmButton: {
      backgroundColor: colors.danger,
    },
    skipConfirmButtonText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    cancelButton: {
      backgroundColor: colors.bgMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelButtonText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
  });
}

export function WorkoutCard({
  session,
  onStart,
  onResume,
  onSkip,
  onSkipComplete,
  isLocked = false,
}: WorkoutCardProps) {
  const { colors } = useTheme();
  const [skipModalVisible, setSkipModalVisible] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [isSkipping, setIsSkipping] = useState(false);

  const styles = useMemo(() => buildStyles(colors), [colors]);

  const isInProgress = session.status === 'in_progress';

  function handleStartWorkout() {
    if (isLocked) return;
    onStart(session.id);
  }

  function handleResumeWorkout() {
    onResume(session.id);
  }

  function handleSkipPress() {
    setSkipReason('');
    setSkipModalVisible(true);
  }

  async function handleConfirmSkip() {
    if (isSkipping) return;
    setIsSkipping(true);
    try {
      await onSkip(session.id, skipReason.trim() || undefined);
      setSkipModalVisible(false);
      onSkipComplete?.();
    } finally {
      setIsSkipping(false);
    }
  }

  function handleCancelSkip() {
    setSkipModalVisible(false);
    setSkipReason('');
  }

  const isFreeFormAdHoc = session.program_id === null && !session.primary_lift;
  const badge = session.intensity_type
    ? getIntensityBadge(session.intensity_type, colors)
    : null;
  const blockLabel = isFreeFormAdHoc
    ? 'Free-form workout'
    : session.program_id === null
      ? 'Ad-Hoc Workout'
      : session.block_number !== null
        ? `Block ${session.block_number} · Week ${session.week_number}`
        : `Week ${session.week_number}`;

  return (
    <>
      <View style={styles.card}>
        {/* Lift name + intensity badge */}
        <View style={styles.cardHeader}>
          <Text style={styles.liftName}>
            {isFreeFormAdHoc
              ? (session.activity_name ?? 'Ad-Hoc Workout')
              : session.primary_lift
                ? session.primary_lift.charAt(0).toUpperCase() +
                  session.primary_lift.slice(1)
                : 'Workout'}
          </Text>
          {badge && (
            <View
              style={[styles.intensityBadge, { backgroundColor: badge.bg }]}
            >
              <Text style={[styles.intensityBadgeText, { color: badge.text }]}>
                {session.intensity_type!.charAt(0).toUpperCase() +
                  session.intensity_type!.slice(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Block / week */}
        <Text style={styles.blockWeekText}>{blockLabel}</Text>

        {/* Sets info */}
        {isFreeFormAdHoc ? (
          <Text style={styles.noSetsText}>Add exercises as you go</Text>
        ) : session.planned_sets === null ? (
          <Text style={styles.noSetsText}>
            Workout generated when you start
          </Text>
        ) : (
          <Text style={styles.setsText}>
            {Array.isArray(session.planned_sets)
              ? session.planned_sets.length
              : 0}{' '}
            sets
          </Text>
        )}

        {/* Planned date */}
        <Text style={styles.dateText}>{formatDate(session.planned_date)}</Text>

        {/* Action buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.button,
              isLocked ? styles.startButtonLocked : styles.startButton,
            ]}
            onPress={isInProgress ? handleResumeWorkout : handleStartWorkout}
            activeOpacity={isLocked ? 1 : 0.85}
          >
            <Text
              style={[
                styles.startButtonText,
                isLocked && styles.startButtonTextLocked,
              ]}
            >
              {isInProgress
                ? 'Resume Workout'
                : isLocked
                  ? 'Another session active'
                  : 'Start Workout'}
            </Text>
          </TouchableOpacity>
          {!isInProgress && !isFreeFormAdHoc && (
            <TouchableOpacity
              style={[styles.button, styles.skipButton]}
              onPress={handleSkipPress}
              activeOpacity={0.8}
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Skip Modal */}
      <Modal
        visible={skipModalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleCancelSkip}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Skip this session?</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Reason (optional)"
              placeholderTextColor={colors.textTertiary}
              value={skipReason}
              onChangeText={setSkipReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.skipConfirmButton,
                isSkipping && styles.modalButtonDisabled,
              ]}
              onPress={handleConfirmSkip}
              disabled={isSkipping}
              activeOpacity={0.8}
            >
              <Text style={styles.skipConfirmButtonText}>
                {isSkipping ? 'Skipping…' : 'Skip Session'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={handleCancelSkip}
              disabled={isSkipping}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
