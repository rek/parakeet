import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useFeatureEnabled } from '@modules/feature-flags';

import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

import { RecordVideoSheet } from './RecordVideoSheet';

/**
 * Compact recording button for the PostRestOverlay.
 * Self-gates behind the videoAnalysis feature flag.
 *
 * When tapped, opens RecordVideoSheet as an absolute-fill overlay.
 * After recording completes, shows a "Recording saved" indicator
 * and calls onRecorded with the video URI.
 */
export function PostRestRecordButton({
  onRecorded,
  onRecordingStateChange,
}: {
  onRecorded: (videoUri: string) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}) {
  const enabled = useFeatureEnabled('videoAnalysis');
  const { colors } = useTheme();
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);
  const [savedUri, setSavedUri] = useState<string | null>(null);

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
          gap: spacing[1.5],
          paddingVertical: spacing[1],
        },
        savedText: {
          fontSize: typography.sizes.xs,
          color: colors.success,
          fontWeight: typography.weights.medium,
        },
        recorderOverlay: {
          ...StyleSheet.absoluteFillObject,
          zIndex: 100,
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
      setSavedUri(videoUri);
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
        <View style={styles.savedIndicator}>
          <Text style={styles.savedText}>Recording saved</Text>
          <TouchableOpacity onPress={handleOpenRecorder} activeOpacity={0.7}>
            <Text
              style={[styles.recordButtonText, { fontSize: typography.sizes.xs }]}
            >
              Re-record
            </Text>
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
          <Text style={styles.recordButtonText}>Record</Text>
        </TouchableOpacity>
      )}

      {isRecorderOpen && (
        <View style={styles.recorderOverlay}>
          <RecordVideoSheet
            onRecorded={handleRecorded}
            onCancel={handleCancel}
            colors={colors}
          />
        </View>
      )}
    </>
  );
}
