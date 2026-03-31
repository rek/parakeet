import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  type Code,
} from 'react-native-vision-camera';

import { captureException } from '@platform/utils/captureException';

import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useClaimInvite } from '../hooks/usePartners';
import { decodeQrPayload } from '../lib/qr-payload';

import { Sheet } from '../../../components/ui/Sheet';

type ScanState =
  | { type: 'scanning' }
  | { type: 'claiming' }
  | { type: 'success'; inviterName: string | null }
  | { type: 'error'; message: string };

export function QrScanSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const { claimInvite } = useClaimInvite();

  const [state, setState] = useState<ScanState>({ type: 'scanning' });
  const processingRef = useRef(false);

  // Auto-close after success
  useEffect(() => {
    if (state.type !== 'success') return;
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [state.type, onClose]);

  const handleCodeScanned = useCallback(
    async (codes: Code[]) => {
      if (processingRef.current) return;
      const code = codes[0];
      if (!code?.value) return;

      const payload = decodeQrPayload({ raw: code.value });
      if (!payload) return;

      processingRef.current = true;
      setState({ type: 'claiming' });

      try {
        const result = await claimInvite({ token: payload.token });
        setState({
          type: 'success',
          inviterName: result.inviterName,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to claim invite';
        captureException(err);
        setState({ type: 'error', message });
      }
    },
    [claimInvite],
  );

  const resetScanner = useCallback(() => {
    processingRef.current = false;
    setState({ type: 'scanning' });
  }, []);

  // Reset state when sheet closes
  const handleClose = useCallback(() => {
    processingRef.current = false;
    setState({ type: 'scanning' });
    onClose();
  }, [onClose]);

  const codeScanner = useMemo(
    () => ({
      codeTypes: ['qr' as const],
      onCodeScanned: handleCodeScanned,
    }),
    [handleCodeScanned],
  );

  return (
    <Sheet
      visible={visible}
      onClose={handleClose}
      title="Scan Partner's QR"
      maxHeight="75%"
    >
      <View style={styles.content}>
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
        ) : state.type === 'scanning' ? (
          <View style={styles.cameraContainer}>
            <Camera
              device={device}
              isActive={visible}
              style={StyleSheet.absoluteFill}
              codeScanner={codeScanner}
            />
            <View style={styles.overlay}>
              <View style={styles.crosshair} />
            </View>
            <Text style={styles.scanHint}>
              Point at your partner's QR code
            </Text>
          </View>
        ) : state.type === 'claiming' ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.hint}>Sending request...</Text>
          </View>
        ) : state.type === 'success' ? (
          <View style={styles.center}>
            <Text style={styles.successIcon}>{'✓'}</Text>
            <Text style={styles.successText}>
              Request sent to {state.inviterName ?? 'partner'}
            </Text>
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.error}>{state.message}</Text>
            <TouchableOpacity
              onPress={resetScanner}
              style={styles.actionButton}
              activeOpacity={0.7}
            >
              <Text style={styles.actionText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Sheet>
  );
}

function buildStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    content: {
      minHeight: 350,
      paddingTop: spacing[4],
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[3],
      flex: 1,
      padding: spacing[4],
    },
    cameraContainer: {
      height: 300,
      marginHorizontal: spacing[4],
      borderRadius: radii.lg,
      overflow: 'hidden',
      position: 'relative',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    crosshair: {
      width: 200,
      height: 200,
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: radii.lg,
    },
    scanHint: {
      textAlign: 'center',
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      paddingVertical: spacing[3],
      paddingHorizontal: spacing[4],
    },
    hint: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    successIcon: {
      fontSize: typography.sizes['5xl'],
      color: colors.success,
    },
    successText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      textAlign: 'center',
    },
    error: {
      fontSize: typography.sizes.sm,
      color: colors.danger,
      textAlign: 'center',
    },
    actionButton: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    actionText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textInverse,
    },
  });
}
