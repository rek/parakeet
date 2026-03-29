import { assembleAnalysis } from '../lib/metrics-assembler';
import type { PoseFrame } from '../lib/pose-types';

/** Default extraction rate — 15fps is sufficient for powerlifting movements. */
const DEFAULT_TARGET_FPS = 15;

/**
 * Run the full analysis pipeline on pre-extracted pose frames.
 *
 * In production, frames come from MediaPipe processing a video.
 * This function is decoupled from the frame extraction source so it
 * can be tested with synthetic frames and swapped to different CV backends.
 *
 * `fps` must reflect the actual extraction rate (not source video rate)
 * so that smoothing windows and peak detection scale correctly.
 */
export function analyzeVideoFrames({
  frames,
  fps,
  lift,
}: {
  frames: PoseFrame[];
  fps: number;
  lift: 'squat' | 'bench' | 'deadlift';
}) {
  return assembleAnalysis({ frames, fps, lift });
}

/**
 * Extract pose frames from a video file.
 *
 * TODO: Implement with react-native-vision-camera + mediapipe plugin.
 * For now, this is a placeholder that throws — callers should check
 * for MediaPipe availability before calling.
 *
 * `targetFps` controls frame subsampling. At 15fps a 30s video yields 450
 * frames instead of 900, giving ~2x faster MediaPipe processing. Use Pose
 * Lite model for large-joint tracking (shoulders, hips, knees, wrists).
 */
export async function extractFramesFromVideo({
  videoUri: _videoUri,
  targetFps: _targetFps = DEFAULT_TARGET_FPS,
  onProgress: _onProgress,
}: {
  videoUri: string;
  targetFps?: number;
  onProgress?: (pct: number) => void;
}): Promise<{ frames: PoseFrame[]; fps: number }> {
  // Phase 1: MediaPipe native module not yet installed.
  // This will be implemented when react-native-vision-camera-mediapipe is added.
  throw new Error(
    'MediaPipe frame extraction not yet available. Use analyzeVideoFrames() with pre-extracted frames for testing.',
  );
}
