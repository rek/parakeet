import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'react-native-compressor';
import { Directory, File, Paths } from 'expo-file-system';

import { captureException } from '@platform/utils/captureException';

import { extractFramesFromVideo, analyzeVideoFrames } from '../application/analyze-video';
import { detectCameraAngle } from '../lib/detect-camera-angle';
import {
  insertSessionVideo,
  getVideoForSessionLift,
  updateSessionVideoAnalysis,
} from '../data/video.repository';
import type { SessionVideo } from '../model/types';

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
  cameraAngle = 'side',
  setContext,
}: {
  sessionId: string;
  lift: string;
  setNumber: number;
  cameraAngle?: 'side' | 'front';
  setContext?: SetContext | null;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SessionVideo | null>(null);

  /** Shared pipeline: analyze → compress → save → update. */
  const processVideo = useCallback(async ({
    videoUri,
    durationSec,
  }: {
    videoUri: string;
    durationSec: number;
  }) => {
    setProgress(0.05);

    // 1. Extract pose frames from uncompressed source (better quality for CV)
    let analysis = null;
    let detectedAngle: 'side' | 'front' = cameraAngle;

    if (durationSec > 0) {
      try {
        // Uses DEFAULT_TARGET_FPS (3fps) — sufficient for form analysis,
        // and stays within device memory limits.
        const { frames, fps } = await extractFramesFromVideo({
          videoUri,
          durationSec,
          onProgress: (p) => setProgress(0.05 + p * 0.55),
        });

        // Auto-detect camera angle from pose landmark separation
        if (frames.length > 0) {
          detectedAngle = detectCameraAngle({ frames });
        }

        if (
          frames.length > 0 &&
          SUPPORTED_LIFTS.includes(lift as typeof SUPPORTED_LIFTS[number])
        ) {
          analysis = analyzeVideoFrames({
            frames,
            fps,
            lift: lift as typeof SUPPORTED_LIFTS[number],
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
    } catch {
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
      cameraAngle: detectedAngle,
      localUri: destUri,
      durationSec,
      setWeightGrams: setContext?.weightGrams,
      setReps: setContext?.reps,
      setRpe: setContext?.rpe,
    });

    // 5. If analysis succeeded, update the DB row with results
    if (analysis) {
      const updated = await updateSessionVideoAnalysis({
        id: saved.id,
        analysis,
      });
      setResult(updated);
    } else {
      setResult(saved);
    }

    setProgress(1);
  }, [sessionId, lift, setNumber, cameraAngle]);

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
      const message = err instanceof Error ? err.message : 'Failed to process video';
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  }, [processVideo]);

  /** Process a video from a file path (e.g., from in-app recording). */
  const processRecordedVideo = useCallback(async ({
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
      const message = err instanceof Error ? err.message : 'Failed to process video';
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  }, [processVideo]);

  const loadExisting = useCallback(async () => {
    try {
      const videos = await getVideoForSessionLift({ sessionId, lift, setNumber });
      if (videos.length > 0) setResult(videos[0]);
    } catch (err) {
      captureException(err);
      const message = err instanceof Error ? err.message : 'Failed to load video';
      setError(message);
    }
  }, [sessionId, lift, setNumber]);

  return {
    pickAndAnalyze,
    processRecordedVideo,
    loadExisting,
    isProcessing,
    progress,
    error,
    result,
  };
}
