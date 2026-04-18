import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { captureException } from '@platform/utils/captureException';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { normalizeVideoUri } from '../lib/normalize-video-uri';

export function ShareVideoButton({
  localUri,
  colors,
}: {
  localUri: string;
  colors: ColorScheme;
}) {
  const [isSharing, setIsSharing] = useState(false);
  const styles = buildStyles(colors);

  async function handlePress() {
    try {
      setIsSharing(true);

      const file = new File(normalizeVideoUri(localUri));
      if (!file.exists) {
        Alert.alert(
          'Video unavailable',
          'This video was recorded on another device and is not stored on this phone.'
        );
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing unavailable', 'This device cannot share files.');
        return;
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: 'video/mp4',
        dialogTitle: 'Share form video',
        UTI: 'public.movie',
      });
    } catch (err) {
      captureException(err);
      const message =
        err instanceof Error ? err.message : 'Failed to share video';
      Alert.alert('Share failed', message);
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handlePress}
      disabled={isSharing}
      activeOpacity={0.75}
      accessible
      accessibilityLabel="Share or export video"
      accessibilityRole="button"
    >
      <Text style={styles.text}>
        {isSharing ? 'Preparing…' : 'Share / Export Video'}
      </Text>
    </TouchableOpacity>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    button: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing[3],
      alignItems: 'center',
      marginTop: spacing[2],
      marginBottom: spacing[4],
    },
    text: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
  });
}
