import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addBreadcrumb, captureException } from '@platform/utils/captureException';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { getVideoMetaData, Video } from 'react-native-compressor';

import {
  analyzeVideoFrames,
  extractFramesFromVideo,
} from '../application/analyze-video';
import {
  reanalyzeSessionVideo,
  SUPPORTED_LIFTS,
} from '../application/reanalyze';
import { videoQueries } from '../data/video.queries';
import {
  insertSessionVideo,
  updateSessionVideoAnalysis,
  updateSessionVideoDebugLandmarks,
} from '../data/video.repository';
import {
  checkLiftMismatch,
  type LiftMismatch,
} from '../lib/check-lift-mismatch';
import { normalizeVideoUri } from '../lib/normalize-video-uri';
import { computeSagittalConfidence } from '../lib/view-confidence';

const LIFT_LABEL: Record<LiftMismatch['detected'], string> = {
  squat: 'squat',
  bench: 'bench press',
  deadlift: 'deadlift',
};

/**
 * Surface a non-blocking warning when the pose classifier thinks the video
 * shows a different competition lift than the one the user declared. Two
 * buttons: `OK, will fix` is an acknowledgement (user still has to delete
 * and re-record manually); `Continue anyway` dismisses.
 *
 * Always runs analysis regardless — this is a nudge, not a gate (see
 * docs/features/video-analysis/spec-lift-label.md).
 */
function showLiftMismatchAlert(mismatch: LiftMismatch): void {
  Alert.alert(
    'Lift label mismatch',
    `This looks like a ${LIFT_LABEL[mismatch.detected]} — you labelled it ${LIFT_LABEL[mismatch.declared]}. Form coaching will be wrong if the label is off.`,
    [
      { text: 'OK, will fix', style: 'default' },
      { text: 'Continue anyway', style: 'cancel' },
    ]
  );
}

export interface SetContext {
  weightGrams: number;
  reps: number;
  rpe?: number;
}

export function useVideoAnalysis({
  sessionId,
  lift,
  setNumber,
  setContext,
}: {
  sessionId: string;
  lift: string;
  setNumber: number;
  setContext?: SetContext | null;
}) {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Query: existing video for this session/lift/set (replaces loadExisting + result useState)
  const queryOpts = videoQueries.forSessionLiftSet({
    sessionId,
    lift,
    setNumber,
  });
  const { data: existingVideos = [] } = useQuery({
    ...queryOpts,
    enabled: !!sessionId && !!lift,
  });
  const result = existingVideos[0] ?? null;

  /** Shared pipeline: analyze → compress → save → update. */
  const processVideo = useCallback(
    async ({
      videoUri,
      durationSec: hintedDurationSec,
    }: {
      videoUri: string;
      durationSec: number;
    }) => {
      setProgress(0.05);

      // Probe the actual file duration via native metadata. ImagePicker reports
      // an unreliable duration on some Android devices (observed: a 12.76s
      // deadlift came back as 4s), and the in-app recorder passes a hard-coded
      // 30s. A wrong duration causes extractFramesFromVideo to stop early and
      // miss entire reps — this is how a real set can land with zero reps
      // detected. Fall back to the hinted value if the probe fails.
      let durationSec = hintedDurationSec;
      let videoWidthPx: number | null = null;
      let videoHeightPx: number | null = null;
      try {
        const meta = await getVideoMetaData(videoUri);
        if (meta.duration > 0) {
          durationSec = meta.duration;
        }
        if (meta.width > 0 && meta.height > 0) {
          videoWidthPx = meta.width;
          videoHeightPx = meta.height;
        }
      } catch (err) {
        captureException(err);
      }

      // 1. Extract pose frames from uncompressed source (better quality for CV)
      let analysis = null;
      let detectedConfidence = 0.8;
      let extractedFrames: unknown[] | null = null;
      let extractedFps = 0;
      let liftMismatch: LiftMismatch | null = null;

      if (durationSec > 0) {
        try {
          // Uses DEFAULT_TARGET_FPS (3fps) — sufficient for form analysis,
          // and stays within device memory limits.
          const { frames, fps } = await extractFramesFromVideo({
            videoUri,
            durationSec,
            onProgress: (p) => setProgress(0.05 + p * 0.55),
          });

          extractedFrames = frames;
          extractedFps = fps;

          // Auto-detect sagittal confidence from pose landmark separation
          if (frames.length > 0) {
            detectedConfidence = computeSagittalConfidence({ frames });
            liftMismatch = checkLiftMismatch({ frames, declared: lift });
          }

          if (
            frames.length > 0 &&
            SUPPORTED_LIFTS.includes(lift as (typeof SUPPORTED_LIFTS)[number])
          ) {
            analysis = analyzeVideoFrames({
              frames,
              fps,
              lift: lift as (typeof SUPPORTED_LIFTS)[number],
            });
          }
        } catch (err) {
          // MediaPipe may not be available (e.g., first install before prebuild).
          // Log but continue — video is still saved for later analysis.
          captureException(err);
        }
      }

      setProgress(0.6);

      // 2. Compress video to reduce storage footprint
      let compressedUri: string;
      try {
        compressedUri = await Video.compress(videoUri, {
          compressionMethod: 'auto',
        });
      } catch (err) {
        captureException(err);
        compressedUri = videoUri;
      }
      setProgress(0.75);

      // 3. Move to app documents directory for persistence across app launches
      const filename = `video_${sessionId}_${lift}_set${setNumber}_${Date.now()}.mp4`;
      const videosDir = new Directory(Paths.document, 'videos');
      if (!videosDir.exists) {
        videosDir.create({ intermediates: true });
      }
      const destFile = new File(videosDir, filename);
      const sourceFile = new File(normalizeVideoUri(compressedUri));
      sourceFile.move(destFile);
      const destUri = destFile.uri;
      setProgress(0.85);

      // 4. Save to database
      const saved = await insertSessionVideo({
        sessionId,
        lift,
        setNumber,
        sagittalConfidence: detectedConfidence,
        localUri: destUri,
        durationSec,
        setWeightGrams: setContext?.weightGrams,
        setReps: setContext?.reps,
        setRpe: setContext?.rpe,
        videoWidthPx,
        videoHeightPx,
      });

      // 5. If analysis succeeded, update the DB row with results
      let finalResult = saved;
      if (analysis) {
        finalResult = await updateSessionVideoAnalysis({
          id: saved.id,
          analysis,
        });
      }

      // Update query cache immediately so UI reflects the new video
      queryClient.setQueryData(queryOpts.queryKey, [finalResult]);

      // Invalidate all video queries so related lists (session videos, lift history) refresh
      queryClient.invalidateQueries({ queryKey: videoQueries.all() });

      // Step 6 (raw-video upload to Supabase Storage) removed in
      // backlog #17. The cloud only needs the structured analysis — the
      // `.mp4` bytes stay on the recording device. `local_uri` remains
      // the source of truth; `remote_uri` is no longer written on new
      // rows (legacy rows keep their value until the Phase 4 column drop).

      // 7. Persist raw landmarks so the playback skeleton overlay can
      // render without re-running MediaPipe (backlog #19 Phase 2).
      // Non-blocking — the row is already saved; losing this write only
      // disables the skeleton overlay on that one video.
      if (extractedFrames) {
        updateSessionVideoDebugLandmarks({
          id: saved.id,
          frames: extractedFrames,
          fps: extractedFps,
        });
      }

      setProgress(1);

      // Surface the mismatch warning after save so the user is not blocked
      // and the video row exists to reference. Fire-and-forget — the user's
      // choice has no downstream effect.
      if (liftMismatch) {
        addBreadcrumb('lift-label-mismatch', 'detected', {
          detected: liftMismatch.detected,
          declared: liftMismatch.declared,
          confidence: liftMismatch.confidence,
        });
        showLiftMismatchAlert(liftMismatch);
      }
    },
    [
      sessionId,
      lift,
      setNumber,
      setContext?.weightGrams,
      setContext?.reps,
      setContext?.rpe,
      queryClient,
      queryOpts.queryKey,
    ]
  );

  /** Pick video from camera roll → process. */
  const pickAndAnalyze = useCallback(async () => {
    try {
      setError(null);
      setIsProcessing(true);
      setProgress(0);

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 1,
      });

      if (picked.canceled || !picked.assets?.[0]) {
        setIsProcessing(false);
        return;
      }

      const asset = picked.assets[0];
      const durationSec = Math.round((asset.duration ?? 0) / 1000);

      await processVideo({ videoUri: asset.uri, durationSec });
    } catch (err) {
      captureException(err);
      const message =
        err instanceof Error ? err.message : 'Failed to process video';
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  }, [processVideo]);

  /**
   * Re-run pose extraction and analysis against the existing local video file,
   * then update the same session_videos row in place. Used after a detector
   * improvement to refresh an existing recording without re-capturing.
   *
   * Orchestration lives in `application/reanalyze.ts` so it can be tested
   * end-to-end against a real Supabase instance without the RN runtime. The
   * hook is a thin wrapper that wires native deps + UI state.
   */
  const reanalyze = useCallback(async () => {
    if (!result) {
      Alert.alert('Re-analyze', 'No video loaded. Pull to refresh and try again.');
      return;
    }
    try {
      setError(null);
      setIsProcessing(true);
      setProgress(0);

      const beforeReps = result.analysis?.reps.length ?? 0;
      // Captured by `onLiftMismatch` inside the orchestrator so we can decide
      // which Alert to show after the pipeline settles — stacking the
      // mismatch warning on top of the "complete" alert flakes on Android.
      let mismatch: LiftMismatch | null = null;

      const updated = await reanalyzeSessionVideo({
        result,
        lift,
        deps: {
          fileExists: (uri) => new File(normalizeVideoUri(uri)).exists,
          getVideoDurationSec: async (uri) => {
            const meta = await getVideoMetaData(uri);
            return meta.duration ?? null;
          },
          extractFrames: extractFramesFromVideo,
          analyze: ({ frames, fps, lift: l }) =>
            analyzeVideoFrames({ frames, fps, lift: l }),
          update: updateSessionVideoAnalysis,
          saveDebugLandmarks: ({ id, frames, fps }) =>
            updateSessionVideoDebugLandmarks({ id, frames, fps }),
          onProgress: setProgress,
          onBreadcrumb: (step, data) =>
            addBreadcrumb('reanalyze', step, data),
          onLiftMismatch: (m) => {
            mismatch = m;
            addBreadcrumb('lift-label-mismatch', 'detected', {
              detected: m.detected,
              declared: m.declared,
              confidence: m.confidence,
            });
          },
        },
      });

      queryClient.setQueryData(queryOpts.queryKey, [updated]);
      queryClient.invalidateQueries({ queryKey: videoQueries.all() });

      if (mismatch) {
        // The mismatch warning subsumes the "complete" summary — the rep
        // count is meaningless if the lift label is wrong.
        showLiftMismatchAlert(mismatch);
      } else {
        const afterReps = updated.analysis?.reps.length ?? 0;
        const delta =
          beforeReps === afterReps
            ? ` (unchanged — detector produced same ${afterReps} reps)`
            : ` (was ${beforeReps})`;
        Alert.alert(
          'Re-analyze complete',
          `Detected ${afterReps} rep${afterReps === 1 ? '' : 's'}${delta}`
        );
      }
    } catch (err) {
      captureException(err);
      const message = err instanceof Error ? err.message : 'Failed to reanalyze';
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  }, [result, lift, queryClient, queryOpts.queryKey]);

  /** Process a video from a file path (e.g., from in-app recording). */
  const processRecordedVideo = useCallback(
    async ({
      videoUri,
      durationSec,
    }: {
      videoUri: string;
      durationSec: number;
    }) => {
      try {
        setError(null);
        setIsProcessing(true);
        setProgress(0);

        await processVideo({ videoUri, durationSec });
      } catch (err) {
        captureException(err);
        const message =
          err instanceof Error ? err.message : 'Failed to process video';
        setError(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [processVideo]
  );

  return {
    pickAndAnalyze,
    processRecordedVideo,
    reanalyze,
    isProcessing,
    progress,
    error,
    result,
  };
}
