import { assembleAnalysis } from '../lib/metrics-assembler';
import type { PoseFrame, PoseLandmark } from '../lib/pose-types';

/** Default extraction rate — 15fps is sufficient for powerlifting movements. */
const DEFAULT_TARGET_FPS = 15;

/** MediaPipe pose landmarker model bundled in android assets via config plugin. */
const POSE_MODEL = 'pose_landmarker_full.task';

/** Zeroed 33-landmark frame for when detection fails — maintains index alignment. */
const EMPTY_FRAME: PoseFrame = Array.from({ length: 33 }, () => ({
  x: 0,
  y: 0,
  z: 0,
  visibility: 0,
}));

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
 * Pipeline:
 * 1. Compute frame timestamps at `targetFps` intervals across the video duration
 * 2. Extract each frame as an image via `expo-video-thumbnails`
 * 3. Run `PoseDetectionOnImage` on each frame to get 33 landmarks
 * 4. Convert MediaPipe `Landmark` → our `PoseLandmark` format
 *
 * Runs sequentially to avoid overwhelming the GPU delegate. A 30s video at
 * 15fps yields ~450 frames — each takes ~10-30ms on modern devices, so total
 * processing is ~5-15s.
 */
export async function extractFramesFromVideo({
  videoUri,
  durationSec,
  targetFps = DEFAULT_TARGET_FPS,
  onProgress,
}: {
  videoUri: string;
  durationSec: number;
  targetFps?: number;
  onProgress?: (pct: number) => void;
}) {
  // Lazy imports — these native modules crash if loaded before the native
  // binary is built with them. Only import when actually extracting frames.
  const { getThumbnailAsync } = require('expo-video-thumbnails') as typeof import('expo-video-thumbnails');
  const { PoseDetectionOnImage, Delegate } = require('react-native-mediapipe') as typeof import('react-native-mediapipe');

  const intervalMs = 1000 / targetFps;
  const totalDurationMs = durationSec * 1000;
  const frameTimes: number[] = [];

  for (let t = 0; t < totalDurationMs; t += intervalMs) {
    frameTimes.push(Math.round(t));
  }

  if (frameTimes.length === 0) {
    return { frames: [] as PoseFrame[], fps: targetFps };
  }

  const totalFrames = frameTimes.length;
  const frames: PoseFrame[] = [];

  // Determine delegate — try GPU first, fall back to CPU if it fails.
  let delegate = Delegate.GPU;
  if (totalFrames > 0) {
    const testThumb = await getThumbnailAsync(videoUri, {
      time: frameTimes[0],
      quality: 0.8,
    });
    try {
      await PoseDetectionOnImage(testThumb.uri, POSE_MODEL, {
        delegate: Delegate.GPU,
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    } catch {
      // GPU delegate failed — fall back to CPU for all frames
      delegate = Delegate.CPU;
    }
  }

  for (let i = 0; i < totalFrames; i++) {
    // Step 1: Extract frame image from video
    const thumbnail = await getThumbnailAsync(videoUri, {
      time: frameTimes[i],
      quality: 0.8,
    });

    // Step 2: Run MediaPipe pose detection on the frame image.
    // Individual frame failures are non-fatal — push empty frame to maintain alignment.
    try {
      const result = await PoseDetectionOnImage(thumbnail.uri, POSE_MODEL, {
        delegate,
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      // Step 3: Convert MediaPipe landmarks to our PoseFrame format
      const poseLandmarks = result.results[0]?.landmarks[0];

      if (poseLandmarks && poseLandmarks.length >= 33) {
        const poseFrame: PoseFrame = poseLandmarks.map((lm) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
          visibility: lm.visibility ?? 0,
        })) satisfies PoseLandmark[];
        frames.push(poseFrame);
      } else {
        frames.push(EMPTY_FRAME);
      }
    } catch {
      // Detection failed on this frame (blurry, occluded, etc.) — skip gracefully
      frames.push(EMPTY_FRAME);
    }

    onProgress?.((i + 1) / totalFrames);
  }

  return { frames, fps: targetFps };
}
