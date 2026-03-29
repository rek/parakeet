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

export function useVideoAnalysis({
  sessionId,
  lift,
  cameraAngle = 'side',
}: {
  sessionId: string;
  lift: string;
  cameraAngle?: 'side' | 'front';
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SessionVideo | null>(null);

  const pickAndAnalyze = useCallback(async () => {
    try {
      setError(null);
      setIsProcessing(true);
      setProgress(0);

      // 1. Pick video from camera roll
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 1,
      });

      if (picked.canceled || !picked.assets?.[0]) {
        setIsProcessing(false);
        return;
      }

      const asset = picked.assets[0];
      setProgress(0.05);

      // 2. Extract pose frames from uncompressed source (better quality for CV)
      const durationSec = Math.round((asset.duration ?? 0) / 1000);
      let analysis = null;
      let detectedAngle: 'side' | 'front' = cameraAngle;

      if (durationSec > 0) {
        try {
          const { frames, fps } = await extractFramesFromVideo({
            videoUri: asset.uri,
            durationSec,
            targetFps: 15,
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

      // 3. Compress video to reduce storage footprint
      let compressedUri: string;
      try {
        compressedUri = await Video.compress(asset.uri, {
          compressionMethod: 'auto',
        });
      } catch {
        // Fallback: some devices fail hardware codec configuration.
        // Use the original URI — larger file but still functional.
        compressedUri = asset.uri;
      }
      setProgress(0.75);

      // 4. Move to app documents directory for persistence across app launches
      const filename = `video_${sessionId}_${lift}_${Date.now()}.mp4`;
      const videosDir = new Directory(Paths.document, 'videos');
      if (!videosDir.exists) {
        videosDir.create({ intermediates: true });
      }
      const destFile = new File(videosDir, filename);
      const sourceFile = new File(compressedUri);
      sourceFile.move(destFile);
      const destUri = destFile.uri;
      setProgress(0.85);

      // 5. Save to database (without analysis initially)
      // Use auto-detected angle from pose landmarks, not the manual picker
      const saved = await insertSessionVideo({
        sessionId,
        lift,
        cameraAngle: detectedAngle,
        localUri: destUri,
        durationSec,
      });

      // 6. If analysis succeeded, update the DB row with results
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

      // TODO: Background upload to Supabase Storage (bucket + upload function ready,
      // wiring deferred). See uploadVideoToStorage in application/video-upload.ts.
    } catch (err) {
      captureException(err);
      const message = err instanceof Error ? err.message : 'Failed to process video';
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  }, [sessionId, lift, cameraAngle]);

  const loadExisting = useCallback(async () => {
    try {
      const video = await getVideoForSessionLift({ sessionId, lift });
      if (video) setResult(video);
    } catch (err) {
      captureException(err);
      const message = err instanceof Error ? err.message : 'Failed to load video';
      setError(message);
    }
  }, [sessionId, lift]);

  return {
    pickAndAnalyze,
    loadExisting,
    isProcessing,
    progress,
    error,
    result,
  };
}
