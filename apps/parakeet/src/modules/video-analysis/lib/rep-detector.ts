import { LANDMARK, type PoseFrame } from './pose-types';

/** Minimum time between peaks — prevents double-detection on a single rep. */
const MIN_PEAK_TIME_SEC = 0.8;
/** Smoothing window target time — matches the ~233ms used at 30fps (7/30). */
const SMOOTH_TIME_SEC = 7 / 30;

/** Extract the Y-coordinate signal used for rep detection based on lift type. */
function extractSignal({
  frames,
  lift,
}: {
  frames: PoseFrame[];
  lift: 'squat' | 'bench' | 'deadlift';
}) {
  return frames.map((frame) => {
    if (lift === 'bench') {
      const lw = frame[LANDMARK.LEFT_WRIST];
      const rw = frame[LANDMARK.RIGHT_WRIST];
      return (lw.y + rw.y) / 2;
    }
    // squat and deadlift both track hip Y
    const lh = frame[LANDMARK.LEFT_HIP];
    const rh = frame[LANDMARK.RIGHT_HIP];
    return (lh.y + rh.y) / 2;
  });
}

/** Moving-average smooth of a 1-D signal. */
function smoothSignal({
  signal,
  windowSize,
}: {
  signal: number[];
  windowSize: number;
}) {
  const half = Math.floor(windowSize / 2);
  return signal.map((_, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(signal.length - 1, i + half);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      sum += signal[j];
      count++;
    }
    return sum / count;
  });
}

/**
 * Find local maxima in a signal with a minimum distance constraint.
 *
 * In MediaPipe, Y increases downward, so the bottom of a squat or deadlift
 * (lowest body position) has the highest Y value. Same for bench — bar at
 * chest is highest Y for the wrists. Local maxima therefore correspond to
 * the bottom / touch-point of each rep.
 */
function findPeaks({
  signal,
  minDistance,
}: {
  signal: number[];
  minDistance: number;
}) {
  const peaks: number[] = [];

  for (let i = 1; i < signal.length - 1; i++) {
    // Detect peaks including plateaus: value drops after AND rose at some
    // point within the last minDistance frames. Handles 2-3+ frame plateaus
    // where consecutive smoothed values are equal (common at low fps).
    if (signal[i] >= signal[i - 1] && signal[i] > signal[i + 1]) {
      let rose = false;
      for (let k = i - 1; k >= Math.max(0, i - minDistance); k--) {
        if (signal[i] > signal[k]) {
          rose = true;
          break;
        }
      }
      if (!rose) continue;
      // Enforce minimum distance from last accepted peak
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
        peaks.push(i);
      } else if (signal[i] > signal[peaks[peaks.length - 1]]) {
        // Same window, higher peak — replace the earlier one
        peaks[peaks.length - 1] = i;
      }
    }
  }

  return peaks;
}

/**
 * Detect rep boundaries from the periodicity of landmark Y coordinates.
 *
 * Each rep is bounded by the midpoints between consecutive bottom-of-rep peaks.
 * Single-rep videos are bounded by the start and end of the signal.
 *
 * Pass `fps` so peak distance and smoothing scale to the actual frame rate.
 * Defaults to 30fps for backward compatibility.
 */
export function detectReps({
  frames,
  lift,
  fps = 30,
}: {
  frames: PoseFrame[];
  lift: 'squat' | 'bench' | 'deadlift';
  fps?: number;
}) {
  const minPeakDistance = Math.max(3, Math.round(fps * MIN_PEAK_TIME_SEC));
  const smoothWindow = Math.max(3, Math.round(fps * SMOOTH_TIME_SEC));

  if (frames.length < minPeakDistance * 2) {
    return [];
  }

  const raw = extractSignal({ frames, lift });
  const smoothed = smoothSignal({ signal: raw, windowSize: smoothWindow });
  const allPeaks = findPeaks({
    signal: smoothed,
    minDistance: minPeakDistance,
  });

  // Compute signal range from non-zero values only — empty/interpolated frames
  // have Y=0 which inflates the range and makes the prominence threshold too high.
  const nonZero = smoothed.filter((v) => v > 0.01);
  const signalMin = nonZero.length > 0 ? Math.min(...nonZero) : 0;
  const signalMax = nonZero.length > 0 ? Math.max(...nonZero) : 0;
  const signalRange = signalMax - signalMin;

  // Filter peaks by minimum prominence: a peak must rise at least 20% of the
  // valid signal range above its deepest flanking valley to count as a real rep.
  // This eliminates walkout dips, between-rep shuffles, and noise from real video
  // landmarks that the synthetic tests didn't expose.
  const MIN_PROMINENCE_RATIO = 0.2;
  const minProminence = signalRange * MIN_PROMINENCE_RATIO;

  const peaks = allPeaks.filter((peakIdx) => {
    if (signalRange < 0.005) return false; // flat signal — no real reps

    // Search for the deepest valley on each side of this peak across the
    // full signal (not just to the next raw peak). This handles noisy signals
    // where many raw peaks exist between true rep bottoms.
    let leftValley = smoothed[peakIdx];
    for (let j = peakIdx - 1; j >= 0; j--) {
      if (smoothed[j] < leftValley) leftValley = smoothed[j];
      // Stop at a deeper peak — we've crossed into another rep's territory
      if (smoothed[j] > smoothed[peakIdx]) break;
    }
    let rightValley = smoothed[peakIdx];
    for (let j = peakIdx + 1; j < smoothed.length; j++) {
      if (smoothed[j] < rightValley) rightValley = smoothed[j];
      if (smoothed[j] > smoothed[peakIdx]) break;
    }

    // Prominence = peak height above the higher of the two flanking valleys
    const prominence = smoothed[peakIdx] - Math.max(leftValley, rightValley);
    return prominence >= minProminence;
  });

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(
      `[reps] ${peaks.length} peaks from ${frames.length} frames (range=${signalRange.toFixed(3)})`
    );
  }

  if (peaks.length === 0) return [];

  const lastFrame = frames.length - 1;
  const reps: { startFrame: number; endFrame: number }[] = [];

  if (peaks.length === 1) {
    reps.push({ startFrame: 0, endFrame: lastFrame });
    return reps;
  }

  // Find valleys (local minima = standing positions) between consecutive peaks.
  // These are the natural rep boundaries — the point where the lifter is most
  // upright between two squat bottoms. Using valleys instead of midpoints
  // ensures each rep slice contains one complete descent→bottom→ascent cycle.
  const boundaries: number[] = [0];
  for (let i = 1; i < peaks.length; i++) {
    let valleyIdx = peaks[i - 1];
    let valleyVal = smoothed[valleyIdx];
    for (let j = peaks[i - 1] + 1; j < peaks[i]; j++) {
      if (smoothed[j] < valleyVal) {
        valleyVal = smoothed[j];
        valleyIdx = j;
      }
    }
    boundaries.push(valleyIdx);
  }
  boundaries.push(lastFrame);

  for (let i = 0; i < peaks.length; i++) {
    reps.push({ startFrame: boundaries[i], endFrame: boundaries[i + 1] });
  }

  return reps;
}
