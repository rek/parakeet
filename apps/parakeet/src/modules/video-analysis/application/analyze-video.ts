// @spec docs/features/video-analysis/spec-pipeline.md
import type { PoseFrame, PoseLandmark } from '../lib/pose-types';

import { analyzeVideoFrames, EMPTY_FRAME } from './analyze-frames';

// Re-export the pure analysis function so existing import sites keep working.
// Dashboard / non-RN consumers should import from `./analyze-frames` directly
// to avoid pulling in this file's RN-only `extractFramesFromVideo`.
export { analyzeVideoFrames };

// 4fps captures 8-16 frames per rep (reps take 2-4s). Good balance between
// analysis quality and device memory. Tested stable at 60 frames (15s video).
// Higher fps (5+) causes OOM kills on memory-constrained devices.
const DEFAULT_TARGET_FPS = 4;

/** MediaPipe pose landmarker model bundled in android assets via config plugin. */
const POSE_MODEL = 'pose_landmarker_lite.task';

function isEmptyFrame(frame: PoseFrame) {
  return frame[0].visibility === 0 && frame[0].x === 0 && frame[0].y === 0;
}

/** Yield to the event loop — lets the native GC run between frames. */
function yieldToGc() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/**
 * Extract pose frames from a video file.
 *
 * Pipeline:
 * 1. Compute frame timestamps at `targetFps` intervals
 * 2. For each frame: extract thumbnail → detect pose → store landmarks → delete thumbnail
 * 3. Yield between frames to allow native GC to reclaim bitmap memory
 *
 * Uses pose_landmarker_lite model (5.6MB vs 9MB full) which uses ~40% less
 * memory per inference. Combined with file cleanup and GC yields, this keeps
 * processing stable on memory-constrained devices.
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
  // Lazy imports — native modules crash if loaded before the binary is built.
  // captureException is also lazy to keep this module importable in Vitest
  // (static import pulls in Sentry → react-native → Rollup parse failure).
  const { getThumbnailAsync } =
    require('expo-video-thumbnails') as typeof import('expo-video-thumbnails');
  const { PoseDetectionOnImage, Delegate } =
    require('react-native-mediapipe') as typeof import('react-native-mediapipe');
  const { File } =
    require('expo-file-system/next') as typeof import('expo-file-system/next');
  const { captureException } =
    require('@platform/utils/captureException') as typeof import('@platform/utils/captureException');

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
  // CPU delegate — GPU causes SIGSEGV in MediaPipe's GL runner on some devices
  const delegate = Delegate.CPU;

  for (let i = 0; i < totalFrames; i++) {
    const thumbnail = await getThumbnailAsync(videoUri, {
      time: frameTimes[i],
      quality: 0.8,
    });

    try {
      const result = await PoseDetectionOnImage(thumbnail.uri, POSE_MODEL, {
        delegate,
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

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
    } catch (err) {
      captureException(err);
      frames.push(EMPTY_FRAME);
    }

    // Delete thumbnail file immediately — prevents native bitmap accumulation
    try {
      new File(thumbnail.uri).delete();
    } catch (err) {
      captureException(err);
    }

    // Yield to event loop — gives native GC a chance to reclaim memory
    await yieldToGc();

    onProgress?.((i + 1) / totalFrames);
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const validCount = frames.filter((f) => !isEmptyFrame(f)).length;
    console.log(
      `[pose] ${validCount}/${totalFrames} valid frames (${Math.round((validCount / totalFrames) * 100)}%)`
    );
  }

  return { frames, fps: targetFps };
}
