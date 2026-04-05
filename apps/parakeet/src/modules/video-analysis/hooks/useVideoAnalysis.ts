import { useCallback, useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { captureException } from '@platform/utils/captureException';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'react-native-compressor';

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
      durationSec,
    }: {
      videoUri: string;
      durationSec: number;
    }) => {
      setProgress(0.05);

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
      const sourceFile = new File(compressedUri);
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
    isProcessing,
    progress,
    error,
    result,
  };
}
