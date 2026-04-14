import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { captureException } from '@platform/utils/captureException';
import { normalizeVideoUri } from '@modules/video-analysis';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';

import { Sheet } from '../../../components/ui/Sheet';
import type { ColorScheme } from '../../../theme';
import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { usePartnerFilming } from '../hooks/usePartnerFilming';
import type { SetSelection } from './PartnerSetPicker';
import { PartnerSetPicker } from './PartnerSetPicker';

type Step = 'pick' | 'record' | 'process' | 'done' | 'error';

export function PartnerFilmingSheet({
  visible,
  onClose,
  partnerId,
  partnerName,
  sessionId,
  lift,
  plannedSets,
}: {
  visible: boolean;
  onClose: () => void;
  partnerId: string;
  partnerName: string;
  sessionId: string;
  lift: string;
  plannedSets: readonly unknown[];
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { filmingState, processVideo, reset } = usePartnerFilming({
    partnerId,
    sessionId,
  });

  const [step, setStep] = useState<Step>('pick');
  const [selection, setSelection] = useState<SetSelection | null>(null);
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isRecording, setIsRecording] = useState(false);

  const handleSelect = useCallback((sel: SetSelection) => {
    setSelection(sel);
    setStep('record');
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (!cameraRef.current) return;
    setIsRecording(true);
    try {
      cameraRef.current.startRecording({
        onRecordingFinished: async (video) => {
          setIsRecording(false);
          setStep('process');
          if (selection) {
            const success = await processVideo({
              videoUri: normalizeVideoUri(video.path),
              durationSec: video.duration,
              lift: selection.lift,
              setNumber: selection.setNumber,
            });
            setStep(success ? 'done' : 'error');
          }
        },
        onRecordingError: (err) => {
          setIsRecording(false);
          captureException(err);
          setStep('error');
        },
      });
    } catch (err) {
      setIsRecording(false);
      captureException(err);
      setStep('error');
    }
  }, [selection, processVideo]);

  const handleStopRecording = useCallback(() => {
    cameraRef.current?.stopRecording();
  }, []);

  const handleClose = useCallback(() => {
    setStep('pick');
    setSelection(null);
    setIsRecording(false);
    reset();
    onClose();
  }, [onClose, reset]);

  const progress =
    filmingState.type === 'analyzing' ? filmingState.progress : 0;

  return (
    <Sheet
      visible={visible}
      onClose={handleClose}
      title={`Film for ${partnerName}`}
      maxHeight="85%"
    >
      {step === 'pick' && (
        <PartnerSetPicker
          lift={lift}
          plannedSets={plannedSets}
          onSelect={handleSelect}
        />
      )}

      {step === 'record' && (
        <View style={styles.recordContainer}>
          {!hasPermission ? (
            <View style={styles.center}>
              <Text style={styles.hint}>Camera permission required</Text>
              <TouchableOpacity
                onPress={requestPermission}
                style={styles.actionButton}
                activeOpacity={0.7}
              >
                <Text style={styles.actionText}>Grant Permission</Text>
              </TouchableOpacity>
            </View>
          ) : !device ? (
            <View style={styles.center}>
              <Text style={styles.hint}>No camera available</Text>
            </View>
          ) : (
            <>
              <Camera
                ref={cameraRef}
                device={device}
                isActive={visible && step === 'record'}
                video
                style={styles.camera}
              />
              <View style={styles.recordControls}>
                <Text style={styles.recordLabel}>
                  Set {selection?.setNumber}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.recordButton,
                    isRecording && styles.recordButtonActive,
                  ]}
                  onPress={
                    isRecording ? handleStopRecording : handleStartRecording
                  }
                  activeOpacity={0.7}
                  accessibilityLabel={
                    isRecording ? 'Stop recording' : 'Start recording'
                  }
                  accessibilityRole="button"
                >
                  <View
                    style={isRecording ? styles.stopIcon : styles.recordIcon}
                  />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}

      {step === 'process' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.progressText}>
            {progress < 0.5
              ? 'Analyzing form...'
              : progress < 0.75
                ? 'Compressing...'
                : 'Uploading...'}
          </Text>
          <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
        </View>
      )}

      {step === 'done' && (
        <View style={styles.center}>
          <Text style={styles.doneIcon}>{'✓'}</Text>
          <Text style={styles.doneText}>Video uploaded to {partnerName}</Text>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.actionButton}
            activeOpacity={0.7}
          >
            <Text style={styles.actionText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'error' && (
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {filmingState.type === 'error'
              ? filmingState.message
              : 'Recording failed'}
          </Text>
          <TouchableOpacity
            onPress={() => setStep('pick')}
            style={styles.actionButton}
            activeOpacity={0.7}
          >
            <Text style={styles.actionText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </Sheet>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing[6],
      gap: spacing[3],
      minHeight: 250,
    },
    recordContainer: {
      height: 400,
      position: 'relative',
    },
    camera: {
      flex: 1,
    },
    recordControls: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      paddingBottom: spacing[6],
      gap: spacing[2],
    },
    recordLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      backgroundColor: colors.overlayLight,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1],
      borderRadius: radii.sm,
      overflow: 'hidden',
    },
    recordButton: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 4,
      borderColor: colors.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recordButtonActive: {
      borderColor: colors.danger,
    },
    recordIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.danger,
    },
    stopIcon: {
      width: 28,
      height: 28,
      borderRadius: 4,
      backgroundColor: colors.danger,
    },
    hint: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    progressText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.medium,
      color: colors.text,
    },
    progressPct: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    doneIcon: {
      fontSize: typography.sizes['5xl'],
      color: colors.success,
    },
    doneText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      textAlign: 'center',
    },
    errorText: {
      fontSize: typography.sizes.sm,
      color: colors.danger,
      textAlign: 'center',
    },
    actionButton: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      borderRadius: radii.md,
      backgroundColor: colors.primary,
    },
    actionText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textInverse,
    },
  });
}
