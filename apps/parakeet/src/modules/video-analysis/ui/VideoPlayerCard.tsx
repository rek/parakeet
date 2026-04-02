import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useVideoPlayer, VideoView } from 'expo-video';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';

/**
 * Video playback card using expo-video.
 * Renders a VideoView with native controls and optional replace action.
 */
export function VideoPlayerCard({
  localUri,
  durationSec,
  onReplace,
  isProcessing,
  colors,
  recordedByName,
}: {
  localUri: string;
  durationSec: number;
  onReplace: () => void;
  isProcessing: boolean;
  colors: ColorScheme;
  recordedByName?: string | null;
}) {
  const styles = useMemo(() => buildStyles(colors), [colors]);

  const player = useVideoPlayer(localUri, (p) => {
    p.loop = false;
  });

  return (
    <View style={styles.container}>
      <View style={styles.videoWrapper}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls
        />
      </View>

      <View style={styles.footer}>
        <View>
          <Text style={styles.durationText}>Duration: {durationSec}s</Text>
          {recordedByName != null && (
            <Text style={styles.attributionText}>
              Recorded by {recordedByName}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.replaceButton}
          onPress={onReplace}
          disabled={isProcessing}
          activeOpacity={0.75}
          accessible
          accessibilityLabel="Replace video"
          accessibilityRole="button"
        >
          <Text style={styles.replaceButtonText}>Replace Video</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginBottom: spacing[4],
    },
    videoWrapper: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: colors.bg,
    },
    video: {
      width: '100%',
      height: '100%',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing[3],
    },
    durationText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    attributionText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },
    replaceButton: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1],
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgMuted,
    },
    replaceButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.textSecondary,
    },
  });
}
