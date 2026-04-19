import { useEffect, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { VideoAnalysisResult } from '@parakeet/shared-types';
import { File } from 'expo-file-system';
import { useVideoPlayer, VideoView } from 'expo-video';

import { useOverlayPreference } from '../hooks/useOverlayPreference';
import { usePlaybackTime } from '../hooks/usePlaybackTime';
import { normalizeVideoUri } from '../lib/normalize-video-uri';
import type { DebugLandmarks } from '../lib/pose-types';
import { computeDisplayRect } from '../lib/video-display-rect';
import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';

import { OverlayToggleChips } from './OverlayToggleChips';
import { PlaybackBarPathOverlay } from './PlaybackBarPathOverlay';
import { PlaybackSkeletonOverlay } from './PlaybackSkeletonOverlay';

/**
 * Video playback card using expo-video.
 * Renders a VideoView with native controls and optional toggle chips for
 * playback overlays (bar path, skeleton).
 */
export function VideoPlayerCard({
  localUri,
  durationSec,
  onReplace,
  isProcessing,
  colors,
  recordedByName,
  analysis,
  videoWidthPx,
  videoHeightPx,
  debugLandmarks,
}: {
  localUri: string;
  durationSec: number;
  onReplace: () => void;
  isProcessing: boolean;
  colors: ColorScheme;
  recordedByName?: string | null;
  analysis?: VideoAnalysisResult | null;
  videoWidthPx?: number | null;
  videoHeightPx?: number | null;
  debugLandmarks?: DebugLandmarks | null;
}) {
  const styles = useMemo(() => buildStyles(colors), [colors]);

  // Probe whether the local file actually exists on this device.
  // Partner videos insert a row into the lifter's account with the
  // partner's device path as `local_uri`, which of course doesn't
  // resolve on the lifter's phone (no cloud fallback since backlog #17).
  // Rather than hand that path to `<VideoView>` and get a silent black
  // frame, render a placeholder and skip spinning up the player.
  const [fileExists, setFileExists] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      setFileExists(new File(normalizeVideoUri(localUri)).exists);
    } catch {
      setFileExists(false);
    }
  }, [localUri]);

  const player = useVideoPlayer(localUri, (p) => {
    p.loop = false;
  });
  const currentTime = usePlaybackTime(player);

  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize((prev) =>
      prev?.width === width && prev?.height === height
        ? prev
        : { width, height }
    );
  };

  const displayRect = useMemo(() => {
    if (!containerSize) return null;
    return computeDisplayRect({
      containerWidth: containerSize.width,
      containerHeight: containerSize.height,
      videoWidthPx: videoWidthPx ?? null,
      videoHeightPx: videoHeightPx ?? null,
    });
  }, [containerSize, videoWidthPx, videoHeightPx]);

  const [barPathEnabled, setBarPathEnabled] = useOverlayPreference('barPath');
  const [skeletonEnabled, setSkeletonEnabled] = useOverlayPreference('skeleton');

  const showBarPath =
    barPathEnabled &&
    analysis != null &&
    analysis.reps.length > 0 &&
    displayRect != null;

  const skeletonAvailable =
    debugLandmarks != null && debugLandmarks.frames.length > 0;
  const showSkeleton =
    skeletonEnabled && skeletonAvailable && displayRect != null;

  return (
    <View style={styles.container}>
      <OverlayToggleChips
        barPathEnabled={barPathEnabled}
        onToggleBarPath={setBarPathEnabled}
        skeletonEnabled={skeletonEnabled}
        onToggleSkeleton={setSkeletonEnabled}
        skeletonAvailable={skeletonAvailable}
        colors={colors}
      />

      <View style={styles.videoWrapper} onLayout={handleLayout}>
        {fileExists === false ? (
          <View style={styles.missingFile}>
            <Text style={styles.missingTitle}>
              Video recorded on another device
            </Text>
            <Text style={styles.missingSubtitle}>
              {recordedByName != null
                ? `${recordedByName} filmed this set — their phone holds the video. The analysis below came from their device.`
                : 'The raw file is not on this phone. Re-record this set to get a new local copy.'}
            </Text>
          </View>
        ) : (
          <VideoView
            player={player}
            style={styles.video}
            contentFit="contain"
            nativeControls
          />
        )}
        {fileExists !== false && showBarPath && analysis && displayRect && (
          <PlaybackBarPathOverlay
            analysis={analysis}
            currentTime={currentTime}
            displayRect={displayRect}
            colors={colors}
          />
        )}
        {fileExists !== false && showSkeleton && debugLandmarks && displayRect && (
          <PlaybackSkeletonOverlay
            frames={debugLandmarks.frames}
            fps={debugLandmarks.fps}
            currentTime={currentTime}
            displayRect={displayRect}
            colors={colors}
          />
        )}
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
      position: 'relative',
    },
    video: {
      width: '100%',
      height: '100%',
    },
    missingFile: {
      width: '100%',
      height: '100%',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[4],
      alignItems: 'center',
      justifyContent: 'center',
    },
    missingTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing[1],
    },
    missingSubtitle: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      textAlign: 'center',
      lineHeight: 16,
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
