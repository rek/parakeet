import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'react-native-compressor';
import { Directory, File, Paths } from 'expo-file-system';

import { captureException } from '@platform/utils/captureException';

import { insertSessionVideo, getVideoForSessionLift } from '../data/video.repository';
import type { SessionVideo } from '../model/types';

export function useVideoAnalysis({
  sessionId,
  lift,
}: {
  sessionId: string;
  lift: string;
  userId: string;
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
      setProgress(0.1);

      // 2. Compress video to reduce storage footprint
      const compressedUri = await Video.compress(asset.uri, {
        compressionMethod: 'auto',
      });
      setProgress(0.3);

      // 3. Move to app documents directory for persistence across app launches
      const filename = `video_${sessionId}_${lift}_${Date.now()}.mp4`;
      const videosDir = new Directory(Paths.document, 'videos');
      videosDir.create({ intermediates: true });
      const destFile = new File(videosDir, filename);
      const sourceFile = new File(compressedUri);
      sourceFile.move(destFile);
      const destUri = destFile.uri;
      setProgress(0.5);

      // 4. Get video duration from picker metadata (ms → s)
      const durationSec = Math.round((asset.duration ?? 0) / 1000);

      // 5. TODO: Extract frames with MediaPipe and run analysis.
      // For now, save the video without analysis — analysis will be
      // available once the MediaPipe native module is integrated.
      // When ready:
      //   const { frames, fps } = await extractFramesFromVideo({
      //     videoUri: destUri,
      //     onProgress: (p) => setProgress(0.5 + p * 0.4),
      //   });
      //   const analysis = analyzeVideoFrames({ frames, fps, lift: lift as 'squat' | 'bench' | 'deadlift' });
      setProgress(0.9);

      // 6. Save to database
      const saved = await insertSessionVideo({
        sessionId,
        lift,
        localUri: destUri,
        durationSec,
      });

      setResult(saved);
      setProgress(1);
    } catch (err) {
      captureException(err);
      const message = err instanceof Error ? err.message : 'Failed to process video';
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  }, [sessionId, lift]);

  const loadExisting = useCallback(async () => {
    try {
      const video = await getVideoForSessionLift({ sessionId, lift });
      if (video) setResult(video);
    } catch (err) {
      captureException(err);
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
