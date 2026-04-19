import { assembleAnalysis } from '../lib/metrics-assembler';
import type { PoseFrame } from '../lib/pose-types';

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

    let prevIdx = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (!isEmptyFrame(result[j])) {
        prevIdx = j;
        break;
      }
    }
    let nextIdx = -1;
    for (let j = i + 1; j < len; j++) {
      if (!isEmptyFrame(frames[j])) {
        nextIdx = j;
        break;
      }
    }

    if (prevIdx >= 0 && nextIdx >= 0) {
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
  }

  return result;
}

/**
 * Run the full analysis pipeline on pre-extracted pose frames.
 *
 * Pure — no React Native, no native modules. Safe to import from any
 * environment (mobile app, dashboard, scripts, tests).
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
  const interpolated = interpolateEmptyFrames({ frames });
  const valid = interpolated.filter((f) => !isEmptyFrame(f));
  const effectiveFps =
    valid.length > 0 ? fps * (valid.length / frames.length) : fps;

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(
      `[analysis] ${valid.length}/${frames.length} usable frames (fps=${effectiveFps.toFixed(1)})`
    );
  }
  return assembleAnalysis({ frames: valid, fps: effectiveFps, lift });
}

export { EMPTY_FRAME };
