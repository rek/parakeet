// @spec docs/features/social/spec-qr-pairing.md
import { useCallback, useEffect, useMemo, useState } from 'react';
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

  const [token, setToken] = useState<string | null>(null);

  const generate = useCallback(async () => {
    reset();
    setToken(null);
    try {
      const result = await createInvite();
      setToken(result.token);
    } catch (err) {
      captureException(err);
    }
  }, [createInvite, reset]);

  useEffect(() => {
    if (visible) {
      generate();
    } else {
      setToken(null);
    }
  }, [visible, generate]);

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

        {token && !isPending && !error && (
          <View style={styles.center}>
            <View style={styles.qrContainer}>
              <QRCode
                value={encodeQrPayload({ token })}
                size={200}
                backgroundColor={colors.bgSurface}
                color={colors.text}
              />
            </View>
            <Text style={styles.hint}>Ask your partner to scan this code</Text>
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
    hint: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      textAlign: 'center',
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
