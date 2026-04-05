import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';

/**
 * In-app video recording with a silhouette guide overlay.
 * Uses react-native-vision-camera for recording.
 * Shows positioning guides for side or front view.
 */
export function RecordVideoSheet({
  onRecorded,
  onCancel,
  colors,
}: {
  onRecorded: (videoUri: string) => void;
  onCancel: () => void;
  colors: ColorScheme;
}) {
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);
  const [isRecording, setIsRecording] = useState(false);

  const handleStartRecording = useCallback(async () => {
    if (!cameraRef.current) return;
    setIsRecording(true);
    cameraRef.current.startRecording({
      onRecordingFinished: (video) => {
        setIsRecording(false);
        onRecorded(video.path);
      },
      onRecordingError: () => {
        setIsRecording(false);
      },
    });
  }, [onRecorded]);

  const handleStopRecording = useCallback(async () => {
    if (!cameraRef.current) return;
    await cameraRef.current.stopRecording();
  }, []);

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission required</Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
          accessible
          accessibilityLabel="Grant camera permission"
          accessibilityRole="button"
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onCancel}
          style={styles.cancelButton}
          accessible
          accessibilityLabel="Cancel"
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>No camera device found</Text>
        <TouchableOpacity
          onPress={onCancel}
          style={styles.cancelButton}
          accessible
          accessibilityLabel="Cancel"
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrapper}>
        <Camera
          ref={cameraRef}
          device={device}
          isActive
          video
          style={styles.camera}
        />

        {/* Guide overlay */}
        <View style={styles.guideOverlay} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            {/* Center line */}
            <Line
              x1="50"
              y1="10"
              x2="50"
              y2="90"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />

            {/* Positioning box */}
            <Rect
              x="20"
              y="15"
              width="60"
              height="70"
              fill="none"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="0.3"
              strokeDasharray="3,2"
              rx="2"
            />

            {/* Camera angle label */}
            <SvgText
              x="50"
              y="8"
              textAnchor="middle"
              fill="rgba(255,255,255,0.6)"
              fontSize="3"
            >
              FILM YOUR SET
            </SvgText>

            {/* Placement hint */}
            <SvgText
              x="50"
              y="95"
              textAnchor="middle"
              fill="rgba(255,255,255,0.5)"
              fontSize="2.5"
            >
              For best depth analysis, film from the side
            </SvgText>
          </Svg>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={onCancel}
          style={styles.cancelButton}
          accessible
          accessibilityLabel="Cancel recording"
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={isRecording ? handleStopRecording : handleStartRecording}
          style={[
            styles.recordButton,
            isRecording && styles.recordButtonActive,
          ]}
          accessible
          accessibilityLabel={
            isRecording ? 'Stop recording' : 'Start recording'
          }
          accessibilityRole="button"
        >
          <View
            style={[styles.recordDot, isRecording && styles.recordDotActive]}
          />
        </TouchableOpacity>

        <View style={styles.spacer} />
      </View>
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    cameraWrapper: {
      flex: 1,
      position: 'relative',
    },
    camera: {
      flex: 1,
    },
    guideOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing[4],
      paddingHorizontal: spacing[6],
      backgroundColor: colors.bg,
    },
    cancelButton: {
      padding: spacing[3],
    },
    cancelText: {
      fontSize: typography.sizes.md,
      color: colors.textSecondary,
    },
    recordButton: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 4,
      borderColor: colors.textSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recordButtonActive: {
      borderColor: colors.danger,
    },
    recordDot: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.danger,
    },
    recordDotActive: {
      width: 28,
      height: 28,
      borderRadius: radii.sm,
    },
    spacer: {
      width: 60,
    },
    permissionText: {
      fontSize: typography.sizes.md,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing[12],
      marginBottom: spacing[4],
    },
    permissionButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing[3],
      paddingHorizontal: spacing[6],
      borderRadius: radii.md,
      alignSelf: 'center',
    },
    permissionButtonText: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: colors.textInverse,
    },
  });
}
