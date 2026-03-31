import { assembleAnalysis } from '../lib/metrics-assembler';
import type { PoseFrame, PoseLandmark } from '../lib/pose-types';

// 4fps captures 8-16 frames per rep (reps take 2-4s). Good balance between
// analysis quality and device memory. Tested stable at 60 frames (15s video).
// Higher fps (5+) causes OOM kills on memory-constrained devices.
const DEFAULT_TARGET_FPS = 4;

/** MediaPipe pose landmarker model bundled in android assets via config plugin. */
const POSE_MODEL = 'pose_landmarker_lite.task';

/** Zeroed 33-landmark frame for when detection fails — maintains index alignment. */
const EMPTY_FRAME: PoseFrame = Array.from({ length: 33 }, () => ({
  x: 0,
  y: 0,
  z: 0,
  visibility: 0,
}));

function isEmptyFrame(frame: PoseFrame) {
  return frame[0].visibility === 0 && frame[0].x === 0 && frame[0].y === 0;
}

/**
 * Interpolate empty frames using linear interpolation from neighboring
 * valid frames. Prevents zero-coordinate frames from corrupting bar path,
 * angle calculations, and rep detection.
 *
 * Strategy:
 * - If a valid neighbor exists on both sides: lerp between them
 * - If only one side has a valid neighbor: copy it (hold)
 * - If no valid neighbors exist: leave as empty (will be filtered later)
 */
function interpolateEmptyFrames({ frames }: { frames: PoseFrame[] }) {
  const result = [...frames];
  const len = frames.length;

  for (let i = 0; i < len; i++) {
    if (!isEmptyFrame(result[i])) continue;

    // Find nearest valid frame before and after
    let prevIdx = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (!isEmptyFrame(result[j])) { prevIdx = j; break; }
    }
    let nextIdx = -1;
    for (let j = i + 1; j < len; j++) {
      if (!isEmptyFrame(frames[j])) { nextIdx = j; break; }
    }

    if (prevIdx >= 0 && nextIdx >= 0) {
      // Lerp between neighbors
      const t = (i - prevIdx) / (nextIdx - prevIdx);
      result[i] = result[prevIdx].map((lm, k) => ({
        x: lm.x + (frames[nextIdx][k].x - lm.x) * t,
        y: lm.y + (frames[nextIdx][k].y - lm.y) * t,
        z: lm.z + (frames[nextIdx][k].z - lm.z) * t,
        visibility: lm.visibility,
      }));
    } else if (prevIdx >= 0) {
      result[i] = result[prevIdx].map((lm) => ({ ...lm }));
    } else if (nextIdx >= 0) {
      result[i] = frames[nextIdx].map((lm) => ({ ...lm }));
    }
    // else: no valid neighbors — stays empty
  }

  return result;
}

/**
 * Run the full analysis pipeline on pre-extracted pose frames.
 *
 * Interpolates empty frames before analysis so that failed detections
 * don't corrupt bar path, angles, or rep detection with zero coordinates.
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
  // Strategy: interpolate short gaps (1-2 frames), drop long gaps.
  // This preserves the signal shape while filling minor detection failures.
  const interpolated = interpolateEmptyFrames({ frames });

  // Filter out any remaining empty frames (from long gaps with no neighbors)
  // and adjust effective fps proportionally.
  const valid = interpolated.filter((f) => !isEmptyFrame(f));
  const effectiveFps = valid.length > 0
    ? fps * (valid.length / frames.length)
    : fps;

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[analysis] ${valid.length}/${frames.length} usable frames (fps=${effectiveFps.toFixed(1)})`);
  }
  return assembleAnalysis({ frames: valid, fps: effectiveFps, lift });
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
  const { getThumbnailAsync } = require('expo-video-thumbnails') as typeof import('expo-video-thumbnails');
  const { PoseDetectionOnImage, Delegate } = require('react-native-mediapipe') as typeof import('react-native-mediapipe');
  const { File } = require('expo-file-system/next') as typeof import('expo-file-system/next');
  const { captureException } = require('@platform/utils/captureException') as typeof import('@platform/utils/captureException');

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
    try { new File(thumbnail.uri).delete(); } catch {}

    // Yield to event loop — gives native GC a chance to reclaim memory
    await yieldToGc();

    onProgress?.((i + 1) / totalFrames);
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const validCount = frames.filter((f) => !isEmptyFrame(f)).length;
    console.log(`[pose] ${validCount}/${totalFrames} valid frames (${Math.round((validCount / totalFrames) * 100)}%)`);
  }

  return { frames, fps: targetFps };
}
