import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { captureException } from '@platform/utils/captureException';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { getVideoMetaData, Video } from 'react-native-compressor';

import {
  analyzeVideoFrames,
  extractFramesFromVideo,
} from '../application/analyze-video';
import { uploadVideoToStorage } from '../application/video-upload';
import { videoQueries } from '../data/video.queries';
import {
  insertSessionVideo,
  updateSessionVideoAnalysis,
  updateSessionVideoDebugLandmarks,
} from '../data/video.repository';
import { normalizeVideoUri } from '../lib/normalize-video-uri';
import { computeSagittalConfidence } from '../lib/view-confidence';

const SUPPORTED_LIFTS = ['squat', 'bench', 'deadlift'] as const;

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

      // 6. Upload to Supabase Storage (non-blocking, best-effort)
      uploadVideoToStorage({ videoId: saved.id, localUri: destUri }).catch(
        captureException
      );

      // 7. In dev builds, store raw landmarks for calibration test harness.
      // Non-blocking — fire and forget so it doesn't slow down the UI.
      if (typeof __DEV__ !== 'undefined' && __DEV__ && extractedFrames) {
        updateSessionVideoDebugLandmarks({
          id: saved.id,
          frames: extractedFrames,
          fps: extractedFps,
        });
      }

      setProgress(1);
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
   */
  const reanalyze = useCallback(async () => {
    // Diagnostic helper — blocks so we can't miss an alert in the middle of
    // a long async flow. Remove once re-analyze is proven reliable.
    const diag = (title: string, message: string) =>
      new Promise<void>((resolve) => {
        Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }]);
      });

    if (!result) {
      await diag('Reanalyze aborted', 'no result in cache');
      return;
    }
    try {
      setError(null);
      setIsProcessing(true);
      setProgress(0.05);

      const videoUri = result.localUri;
      const file = new File(normalizeVideoUri(videoUri));
      const fileExists = file.exists;
      if (!fileExists) {
        await diag(
          'Reanalyze: file missing',
          `local_uri=${videoUri}`
        );
        throw new Error('Local video file missing');
      }

      let durationSec = result.durationSec;
      try {
        const meta = await getVideoMetaData(videoUri);
        if (meta.duration > 0) durationSec = meta.duration;
      } catch (err) {
        captureException(err);
      }

      let analysis = null;
      let extractedFrames: unknown[] | null = null;
      let extractedFps = 0;

      if (durationSec > 0) {
        const { frames, fps } = await extractFramesFromVideo({
          videoUri,
          durationSec,
          onProgress: (p) => setProgress(0.05 + p * 0.8),
        });

        extractedFrames = frames;
        extractedFps = fps;

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

        await diag(
          'Reanalyze: extraction done',
          `duration=${durationSec.toFixed(1)}s frames=${frames.length} lift=${lift} analysisNull=${analysis == null} reps=${analysis?.reps?.length ?? 'n/a'}`
        );
      }

      if (!analysis) {
        throw new Error('analysis is null (extraction returned empty)');
      }

      const updated = await updateSessionVideoAnalysis({
        id: result.id,
        analysis,
      });
      await diag(
        'Reanalyze: DB update ok',
        `id=${result.id} reps=${updated.analysis?.reps?.length ?? 'n/a'}`
      );
      queryClient.setQueryData(queryOpts.queryKey, [updated]);
      queryClient.invalidateQueries({ queryKey: videoQueries.all() });

      if (typeof __DEV__ !== 'undefined' && __DEV__ && extractedFrames) {
        updateSessionVideoDebugLandmarks({
          id: result.id,
          frames: extractedFrames,
          fps: extractedFps,
        });
      }

      setProgress(1);
    } catch (err) {
      captureException(err);
      const message =
        err instanceof Error ? err.message : 'Failed to reanalyze';
      await diag('Reanalyze failed', message);
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
