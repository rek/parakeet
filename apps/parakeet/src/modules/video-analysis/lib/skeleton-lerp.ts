// @spec docs/features/video-analysis/spec-playback-overlay.md
import type { PoseFrame, PoseLandmark } from './pose-types';

/**
 * Interpolate the pose for the given playback time between two stored
 * frames. Sparse MediaPipe output (3–4 fps) would otherwise snap from
 * frame to frame and look janky during 30 fps video playback.
 *
 * Per-landmark linear interpolation of `x/y/z`. Visibility uses the
 * `floor` frame's value rather than lerping so a partially-occluded
 * landmark cannot suddenly become visible mid-interpolation (which would
 * make the overlay "rubber-band" — see design doc Risk table).
 *
 * Returns `null` when there are no frames to interpolate against. Callers
 * should hide the overlay in that case.
 */
export function lerpPoseFrame({
  frames,
  fps,
  currentTime,
}: {
  frames: PoseFrame[];
  fps: number;
  currentTime: number;
}): PoseFrame | null {
  if (frames.length === 0) return null;
  if (fps <= 0) return null;

  const frameIdxFloat = currentTime * fps;
  if (frameIdxFloat <= 0) return frames[0];
  if (frameIdxFloat >= frames.length - 1) return frames[frames.length - 1];

  const floorIdx = Math.floor(frameIdxFloat);
  const ceilIdx = Math.min(floorIdx + 1, frames.length - 1);
  const t = frameIdxFloat - floorIdx;

  const a = frames[floorIdx];
  const b = frames[ceilIdx];
  if (a.length !== b.length) return a;

  const out: PoseLandmark[] = new Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const la = a[i];
    const lb = b[i];
    out[i] = {
      x: la.x + (lb.x - la.x) * t,
      y: la.y + (lb.y - la.y) * t,
      z: la.z + (lb.z - la.z) * t,
      // Keep the floor frame's visibility — see docstring.
      visibility: la.visibility,
    };
  }
  return out;
}
