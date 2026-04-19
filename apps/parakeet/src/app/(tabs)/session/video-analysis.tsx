import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  BarPathOverlay,
  BaselineDeviationBadge,
  computePersonalBaseline,
  computeReadinessFromVerdicts,
  detectBaselineDeviations,
  FormCoachingCard,
  IntraSessionComparison,
  LongitudinalComparison,
  ReadinessCard,
  RecordVideoSheet,
  RepMetricsCard,
  ShareVideoButton,
  useFormCoaching,
  usePreviousVideos,
  useSessionVideos,
  useVideoAnalysis,
  VideoPlayerCard,
} from '@modules/video-analysis';
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
 * Pick a video from the camera roll → MediaPipe extracts pose landmarks →
 * analysis pipeline computes bar path, rep detection, form faults →
 * display video playback with per-rep metrics and bar path overlays.
 */
export default function VideoAnalysisScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  const {
    sessionId,
    lift,
    setNumber: setNumberParam,
    weightGrams: weightGramsParam,
    reps: repsParam,
    rpe: rpeParam,
  } = useLocalSearchParams<{
    sessionId: string;
    lift: string;
    setNumber: string;
    weightGrams: string;
    reps: string;
    rpe: string;
  }>();

  const parsedSetNumber = parseInt(setNumberParam ?? '1', 10) || 1;
  const rawWeight = weightGramsParam ? parseInt(weightGramsParam, 10) : null;
  const rawReps = repsParam ? parseInt(repsParam, 10) : null;
  const rawRpe = rpeParam ? parseFloat(rpeParam) : null;
  const parsedWeightGrams = Number.isFinite(rawWeight) ? rawWeight : null;
  const parsedReps = Number.isFinite(rawReps) ? rawReps : null;
  const parsedRpe = Number.isFinite(rawRpe) ? rawRpe : null;

  const setContext =
    parsedWeightGrams != null
      ? {
          weightGrams: parsedWeightGrams,
          reps: parsedReps ?? 0,
          rpe: parsedRpe ?? undefined,
        }
      : null;

  const liftLabel = LIFT_LABELS[lift as Lift] ?? capitalize(lift ?? 'Lift');

  // Rich title with set context when available
  const screenTitle = parsedWeightGrams
    ? `${liftLabel} — Set ${parsedSetNumber} @ ${parsedWeightGrams / 1000}kg × ${parsedReps ?? '?'}${parsedRpe ? ` (RPE ${parsedRpe})` : ''}`
    : `${liftLabel} Form Analysis`;

  const [isRecording, setIsRecording] = useState(false);

  const {
    pickAndAnalyze,
    processRecordedVideo,
    reanalyze,
    isProcessing,
    progress,
    error,
    result,
  } = useVideoAnalysis({
    sessionId: sessionId ?? '',
    lift: lift ?? '',
    setNumber: parsedSetNumber,
    setContext,
  });

  const {
    generateCoaching,
    isGenerating: isCoachingGenerating,
    error: coachingError,
    coaching,
    setCoaching,
  } = useFormCoaching({
    sessionId: sessionId ?? '',
    lift: lift ?? '',
  });

  const { videos: sessionVideos } = useSessionVideos({
    sessionId: sessionId ?? '',
    lift: lift ?? '',
  });

  const { previousVideos } = usePreviousVideos({
    lift: lift ?? '',
    currentVideoId: result?.id ?? null,
  });

  const baseline = useMemo(() => {
    const previousAnalyses = previousVideos
      .filter((v) => v.analysis != null)
      .map((v) => v.analysis!);
    return computePersonalBaseline({ analyses: previousAnalyses });
  }, [previousVideos]);

  // Initialize coaching state from existing video
  useEffect(() => {
    if (result?.coachingResponse) {
      setCoaching(result.coachingResponse);
    }
  }, [result?.coachingResponse, setCoaching]);

  // Surface errors via Alert so they're not silently dropped
  useEffect(() => {
    if (error) {
      Alert.alert('Video Error', error);
    }
  }, [error]);

  useEffect(() => {
    if (coachingError) {
      Alert.alert('Coaching Error', coachingError);
    }
  }, [coachingError]);

  const analysis = result?.analysis ?? null;

  // Compute competition readiness from all video verdicts (current + previous)
  const readinessScore = useMemo(() => {
    const allAnalyses = [
      ...(analysis ? [analysis] : []),
      ...previousVideos.filter((v) => v.analysis).map((v) => v.analysis!),
    ];
    const allVerdicts = allAnalyses.flatMap((a) =>
      a.reps.filter((r) => r.verdict).map((r) => r.verdict!)
    );
    const videoCount =
      (analysis ? 1 : 0) + previousVideos.filter((v) => v.analysis).length;
    return computeReadinessFromVerdicts({
      verdicts: allVerdicts,
      window: videoCount,
    });
  }, [analysis, previousVideos]);

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
        <Text style={styles.title}>{screenTitle}</Text>

        {/* Video section */}
        <Text style={styles.sectionHeader}>Video</Text>

        {!result ? (
          // No video yet — show pick and record buttons
          <>
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
                Pick a video from your camera roll
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.recordVideoButton}
              onPress={() => setIsRecording(true)}
              disabled={isProcessing}
              activeOpacity={0.75}
              accessible={true}
              accessibilityLabel="Record a new video"
              accessibilityRole="button"
            >
              <Text style={styles.recordVideoText}>Record Video</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <VideoPlayerCard
              localUri={result.localUri}
              durationSec={result.durationSec}
              onReplace={pickAndAnalyze}
              isProcessing={isProcessing}
              colors={colors}
              analysis={result.analysis}
              videoWidthPx={result.videoWidthPx}
              videoHeightPx={result.videoHeightPx}
              debugLandmarks={result.debugLandmarks}
              recordedByName={result.recordedByName}
            />
            <TouchableOpacity
              style={styles.reanalyzeButton}
              onPress={reanalyze}
              disabled={isProcessing}
              activeOpacity={0.75}
              accessible
              accessibilityLabel="Re-run analysis on this video"
              accessibilityRole="button"
            >
              <Text style={styles.reanalyzeText}>
                {isProcessing ? 'Re-analyzing…' : 'Re-analyze'}
              </Text>
            </TouchableOpacity>
            <ShareVideoButton localUri={result.localUri} colors={colors} />
          </>
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
              style={[
                styles.progressBarFill,
                { width: `${Math.round(progress * 100)}%` },
              ]}
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
              Select a video above to analyze your form. Pose estimation runs
              on-device — results appear automatically after processing.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.analysisMetaText}>
              {analysis.reps.length} rep
              {analysis.reps.length !== 1 ? 's' : ''} detected · {analysis.fps}{' '}
              fps · {`${Math.round(analysis.sagittalConfidence * 100)}% side confidence`}
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

            {/* Rep metrics cards + verdict badges + baseline deviations */}
            {analysis.reps.map((rep) => (
              <View key={rep.repNumber}>
                <RepMetricsCard
                  rep={rep}
                  lift={lift ?? ''}
                  colors={colors}
                  verdict={rep.verdict}
                />
                {baseline &&
                  detectBaselineDeviations({
                    rep,
                    baseline,
                    lift: (lift ?? 'squat') as 'squat' | 'bench' | 'deadlift',
                  }).map((d) => (
                    <BaselineDeviationBadge
                      key={d.metric}
                      deviation={d}
                      colors={colors}
                    />
                  ))}
              </View>
            ))}

            {/* Competition readiness */}
            {readinessScore && (
              <ReadinessCard
                score={readinessScore}
                lift={lift ?? ''}
                colors={colors}
              />
            )}

            {/* Other set videos for this session+lift */}
            {sessionVideos.length > 1 && (
              <View style={styles.sessionVideosSection}>
                <Text style={styles.sectionLabel}>OTHER SETS</Text>
                <View style={styles.setVideoList}>
                  {sessionVideos
                    .filter((v) => v.id !== result?.id)
                    .map((v) => (
                      <TouchableOpacity
                        key={v.id}
                        style={styles.setVideoChip}
                        onPress={() =>
                          router.replace({
                            pathname: '/session/video-analysis' as never,
                            params: {
                              sessionId: sessionId ?? '',
                              lift: lift ?? '',
                              setNumber: String(v.setNumber),
                              ...(v.setWeightGrams != null
                                ? { weightGrams: String(v.setWeightGrams) }
                                : {}),
                              ...(v.setReps != null
                                ? { reps: String(v.setReps) }
                                : {}),
                              ...(v.setRpe != null
                                ? { rpe: String(v.setRpe) }
                                : {}),
                            },
                          })
                        }
                        activeOpacity={0.7}
                      >
                        <Text style={styles.setVideoChipText}>
                          Set {v.setNumber}
                          {v.setWeightGrams
                            ? ` · ${v.setWeightGrams / 1000}kg`
                            : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </View>
            )}

            {/* Intra-session comparison (set-to-set bar path overlay) */}
            <IntraSessionComparison videos={sessionVideos} />

            {/* Longitudinal comparison (cross-session) */}
            <LongitudinalComparison
              currentAnalysis={analysis}
              previousVideos={previousVideos}
              colors={colors}
            />

            {/* AI coaching */}
            <FormCoachingCard
              coaching={coaching}
              isGenerating={isCoachingGenerating}
              error={coachingError}
              onGenerate={() => result && generateCoaching({ video: result })}
              colors={colors}
            />
          </>
        )}
      </ScrollView>

      {isRecording && (
        <View style={styles.recordingOverlay}>
          <RecordVideoSheet
            onRecorded={(videoUri) => {
              setIsRecording(false);
              processRecordedVideo({ videoUri, durationSec: 30 });
            }}
            onCancel={() => setIsRecording(false)}
            colors={colors}
          />
        </View>
      )}
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
    recordVideoButton: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing[3],
      alignItems: 'center',
      marginBottom: spacing[4],
    },
    recordVideoText: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
    reanalyzeButton: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing[3],
      alignItems: 'center',
      marginTop: spacing[2],
    },
    reanalyzeText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
    recordingOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 10,
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
    // Phase 4: session video list
    sectionLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing[2],
    },
    sessionVideosSection: {
      marginTop: spacing[4],
      gap: spacing[2],
    },
    setVideoList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    setVideoChip: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1.5],
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgSurface,
    },
    setVideoChipText: {
      fontSize: typography.sizes.sm,
      color: colors.text,
    },
  });
}
