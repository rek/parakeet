import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useVideoAnalysis } from '@modules/video-analysis';
import { BarPathOverlay, RepMetricsCard } from '@modules/video-analysis';
import type { Lift } from '@parakeet/shared-types';
import { LIFT_LABELS } from '@shared/constants';
import { capitalize } from '@shared/utils/string';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../../components/navigation/BackLink';
import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

/**
 * Video form analysis screen.
 *
 * Phase 1: Pick a video from the camera roll, show a placeholder player card
 * with the video URI, and display per-rep metrics if analysis exists.
 * MediaPipe frame extraction is not yet integrated — analysis is shown when
 * the analysis field is populated on the session_videos record.
 *
 * Phase 2: Replace the placeholder card with <VideoView> (expo-video) and
 * overlay BarPathOverlay directly on top of the video.
 */
export default function VideoAnalysisScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  const { sessionId, lift } = useLocalSearchParams<{
    sessionId: string;
    lift: string;
  }>();

  const liftLabel =
    LIFT_LABELS[lift as Lift] ?? capitalize(lift ?? 'Lift');

  const { pickAndAnalyze, loadExisting, isProcessing, progress, error, result } =
    useVideoAnalysis({
      sessionId: sessionId ?? '',
      lift: lift ?? '',
      userId: '',
    });

  // Load any existing video for this session+lift on mount
  useEffect(() => {
    if (sessionId && lift) {
      loadExisting();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, lift]);

  // Surface errors via Alert so they're not silently dropped
  useEffect(() => {
    if (error) {
      Alert.alert('Video Error', error);
    }
  }, [error]);

  const analysis = result?.analysis ?? null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <BackLink onPress={() => router.back()} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{liftLabel} Form Analysis</Text>

        {/* Video section */}
        <Text style={styles.sectionHeader}>Video</Text>

        {!result ? (
          // No video yet — show pick button
          <TouchableOpacity
            style={styles.selectVideoButton}
            onPress={pickAndAnalyze}
            disabled={isProcessing}
            activeOpacity={0.75}
            accessible={true}
            accessibilityLabel="Select a video from your camera roll"
            accessibilityRole="button"
          >
            <Text style={styles.selectVideoIcon}>📹</Text>
            <Text style={styles.selectVideoText}>Select Video</Text>
            <Text style={styles.selectVideoHint}>
              Pick a side-view video from your camera roll
            </Text>
          </TouchableOpacity>
        ) : (
          // Video exists — show placeholder card
          // TODO: Replace with <VideoView> when expo-video is added
          <View style={styles.videoPlaceholder}>
            <Text style={styles.videoPlaceholderIcon}>🎞</Text>
            <Text style={styles.videoUri} numberOfLines={2}>
              {result.localUri}
            </Text>
            <Text style={styles.videoDuration}>
              Duration: {result.durationSec}s
            </Text>
            <TouchableOpacity
              style={styles.replaceButton}
              onPress={pickAndAnalyze}
              disabled={isProcessing}
              activeOpacity={0.75}
              accessible={true}
              accessibilityLabel="Replace video"
              accessibilityRole="button"
            >
              <Text style={styles.replaceButtonText}>Replace Video</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Processing progress */}
        {isProcessing && (
          <View style={styles.processingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.processingText}>
              Processing… {Math.round(progress * 100)}%
            </Text>
          </View>
        )}

        {/* Progress bar */}
        {isProcessing && (
          <View style={styles.progressBarTrack}>
            <View
              style={[styles.progressBarFill, { width: `${Math.round(progress * 100)}%` }]}
            />
          </View>
        )}

        {/* Analysis section */}
        <Text style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
          Analysis
        </Text>

        {!analysis ? (
          <View style={styles.analysisPlaceholder}>
            <Text style={styles.analysisPlaceholderText}>
              Analysis will be available when MediaPipe processing is
              integrated. Select a video above to save it — results will appear
              here once processing is complete.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.analysisMetaText}>
              {analysis.reps.length} rep
              {analysis.reps.length !== 1 ? 's' : ''} detected · {analysis.fps}{' '}
              fps · {analysis.cameraAngle} view
            </Text>

            {/* Bar path overlays — one per rep */}
            {analysis.reps.map((rep) =>
              rep.barPath.length > 0 ? (
                <BarPathOverlay
                  key={rep.repNumber}
                  points={rep.barPath}
                  repNumber={rep.repNumber}
                  colors={colors}
                />
              ) : null
            )}

            {/* Rep metrics cards */}
            {analysis.reps.map((rep) => (
              <RepMetricsCard
                key={rep.repNumber}
                rep={rep}
                lift={lift ?? ''}
                colors={colors}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: spacing[4], paddingTop: spacing[2] },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: spacing[12],
    },
    title: {
      fontSize: typography.sizes['2xl'],
      fontWeight: typography.weights.black,
      color: colors.text,
      marginBottom: spacing[5],
      letterSpacing: typography.letterSpacing.tight,
    },
    sectionHeader: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.widest,
      marginBottom: spacing[3],
    },
    sectionHeaderSpaced: {
      marginTop: spacing[6],
    },
    // Empty / select-video button
    selectVideoButton: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      paddingVertical: spacing[8],
      alignItems: 'center',
      gap: spacing[2],
      marginBottom: spacing[4],
    },
    selectVideoIcon: {
      fontSize: 40,
    },
    selectVideoText: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
    selectVideoHint: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
      textAlign: 'center',
      paddingHorizontal: spacing[6],
    },
    // Video placeholder card (replaces <VideoView> until expo-video is added)
    videoPlaceholder: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[4],
      marginBottom: spacing[4],
      alignItems: 'center',
      gap: spacing[2],
    },
    videoPlaceholderIcon: {
      fontSize: 32,
    },
    videoUri: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      fontFamily: typography.families.mono,
      textAlign: 'center',
    },
    videoDuration: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    replaceButton: {
      marginTop: spacing[2],
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
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
    // Processing state
    processingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      marginBottom: spacing[2],
    },
    processingText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    progressBarTrack: {
      height: 4,
      backgroundColor: colors.bgMuted,
      borderRadius: radii.full,
      overflow: 'hidden',
      marginBottom: spacing[4],
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: radii.full,
    },
    // Analysis placeholder
    analysisPlaceholder: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[5],
    },
    analysisPlaceholderText: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
      lineHeight: 20,
    },
    analysisMetaText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginBottom: spacing[4],
    },
  });
}
