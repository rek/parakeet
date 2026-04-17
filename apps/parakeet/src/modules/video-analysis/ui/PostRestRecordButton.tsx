import { useCallback, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useFeatureEnabled } from '@modules/feature-flags';

import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

import { RecordVideoSheet } from './RecordVideoSheet';

/**
 * Compact recording button for the PostRestOverlay.
 * Self-gates behind the videoAnalysis feature flag.
 *
 * Saved-video state is owned by the caller (via `savedUri` prop) so it
 * survives PostRestOverlay unmount/remount during +15s resets.
 */
export function PostRestRecordButton({
  savedUri,
  onRecorded,
  onRecordingStateChange,
}: {
  savedUri: string | null;
  onRecorded: (videoUri: string) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}) {
  const enabled = useFeatureEnabled('videoAnalysis');
  const { colors } = useTheme();
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        recordButton: {
          width: '100%',
          backgroundColor: colors.bgMuted,
          borderRadius: radii.md,
          paddingVertical: spacing[2],
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: spacing[1.5],
        },
        recordDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.danger,
        },
        recordButtonText: {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.semibold,
          color: colors.textSecondary,
        },
        savedIndicator: {
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing[2],
          paddingVertical: spacing[1],
        },
        savedText: {
          fontSize: typography.sizes.xs,
          color: colors.success,
          fontWeight: typography.weights.medium,
        },
        reRecordText: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.semibold,
          color: colors.textSecondary,
          textDecorationLine: 'underline',
        },
      }),
    [colors]
  );

  const handleOpenRecorder = useCallback(() => {
    setIsRecorderOpen(true);
    onRecordingStateChange?.(true);
  }, [onRecordingStateChange]);

  const handleRecorded = useCallback(
    (videoUri: string) => {
      setIsRecorderOpen(false);
      onRecordingStateChange?.(false);
      onRecorded(videoUri);
    },
    [onRecorded, onRecordingStateChange]
  );

  const handleCancel = useCallback(() => {
    setIsRecorderOpen(false);
    onRecordingStateChange?.(false);
  }, [onRecordingStateChange]);

  if (!enabled) return null;

  return (
    <>
      {savedUri ? (
        <View
          style={styles.savedIndicator}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel="Video ready. Tap Complete to analyze."
        >
          <Text style={styles.savedText}>Video ready</Text>
          <TouchableOpacity
            onPress={handleOpenRecorder}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Re-record set video"
          >
            <Text style={styles.reRecordText}>Re-record</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.recordButton}
          onPress={handleOpenRecorder}
          activeOpacity={0.7}
          accessible
          accessibilityLabel="Record set video"
          accessibilityRole="button"
        >
          <View style={styles.recordDot} />
          <Text style={styles.recordButtonText}>Record</Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={isRecorderOpen}
        animationType="fade"
        presentationStyle="overFullScreen"
        transparent
        onRequestClose={handleCancel}
      >
        <RecordVideoSheet
          onRecorded={handleRecorded}
          onCancel={handleCancel}
          colors={colors}
        />
      </Modal>
    </>
  );
}
