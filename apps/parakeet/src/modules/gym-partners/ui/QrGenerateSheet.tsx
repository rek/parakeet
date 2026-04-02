import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { captureException } from '@platform/utils/captureException';
import QRCode from 'react-native-qrcode-svg';

import { Sheet } from '../../../components/ui/Sheet';
import { spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useCreateInvite } from '../hooks/usePartners';
import { encodeQrPayload } from '../lib/qr-payload';

export function QrGenerateSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { createInvite, isPending, error, reset } = useCreateInvite();

  const [invite, setInvite] = useState<{
    token: string;
    expiresAt: string;
  } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generate = useCallback(async () => {
    reset();
    setInvite(null);
    try {
      const result = await createInvite();
      setInvite(result);
      setSecondsLeft(
        Math.max(
          0,
          Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000)
        )
      );
    } catch (err) {
      captureException(err);
    }
  }, [createInvite, reset]);

  // Generate on open
  useEffect(() => {
    if (visible) {
      generate();
    } else {
      setInvite(null);
      setSecondsLeft(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [visible, generate]);

  // Countdown timer
  useEffect(() => {
    if (!invite) return;

    timerRef.current = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(invite.expiresAt).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
      if (remaining <= 0 && timerRef.current) {
        clearInterval(timerRef.current);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [invite]);

  const expired = secondsLeft <= 0 && invite !== null;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <Sheet visible={visible} onClose={onClose} title="Add Partner">
      <View style={styles.content}>
        {isPending && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.hint}>Generating QR code...</Text>
          </View>
        )}

        {error && (
          <View style={styles.center}>
            <Text style={styles.error}>{error.message}</Text>
            <TouchableOpacity
              onPress={generate}
              style={styles.retryButton}
              activeOpacity={0.7}
            >
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {invite && !isPending && !error && (
          <View style={styles.center}>
            {expired ? (
              <>
                <Text style={styles.expired}>QR code expired</Text>
                <TouchableOpacity
                  onPress={generate}
                  style={styles.retryButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.retryText}>Regenerate</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.qrContainer}>
                  <QRCode
                    value={encodeQrPayload({ token: invite.token })}
                    size={200}
                    backgroundColor={colors.bgSurface}
                    color={colors.text}
                  />
                </View>
                <Text style={styles.timer}>
                  {minutes}:{seconds.toString().padStart(2, '0')}
                </Text>
                <Text style={styles.hint}>
                  Ask your partner to scan this code
                </Text>
              </>
            )}
          </View>
        )}
      </View>
    </Sheet>
  );
}

function buildStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    content: {
      padding: spacing[4],
      minHeight: 300,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[3],
      flex: 1,
    },
    qrContainer: {
      padding: spacing[4],
      borderRadius: 16,
      backgroundColor: colors.bgSurface,
    },
    timer: {
      fontSize: typography.sizes['2xl'],
      fontWeight: typography.weights.bold,
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    hint: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    expired: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
    error: {
      fontSize: typography.sizes.sm,
      color: colors.danger,
      textAlign: 'center',
    },
    retryButton: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    retryText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textInverse,
    },
  });
}
