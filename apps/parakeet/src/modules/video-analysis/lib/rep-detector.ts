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
function smoothSignal({ signal, windowSize }: { signal: number[]; windowSize: number }) {
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
function findPeaks({ signal, minDistance }: { signal: number[]; minDistance: number }) {
  const peaks: number[] = [];

  for (let i = 1; i < signal.length - 1; i++) {
    // Detect peaks including plateaus: value drops after AND rose at some
    // point within the last minDistance frames. Handles 2-3+ frame plateaus
    // where consecutive smoothed values are equal (common at low fps).
    if (signal[i] >= signal[i - 1] && signal[i] > signal[i + 1]) {
      let rose = false;
      for (let k = i - 1; k >= Math.max(0, i - minDistance); k--) {
        if (signal[i] > signal[k]) { rose = true; break; }
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

  console.log(`[reps] detectReps: ${frames.length} frames, fps=${fps}, lift=${lift}, minPeakDist=${minPeakDistance}, smoothWin=${smoothWindow}`);

  if (frames.length < minPeakDistance * 2) {
    console.log(`[reps] too few frames (${frames.length} < ${minPeakDistance * 2}), returning 0 reps`);
    return [];
  }

  const raw = extractSignal({ frames, lift });
  const smoothed = smoothSignal({ signal: raw, windowSize: smoothWindow });
  const allPeaks = findPeaks({ signal: smoothed, minDistance: minPeakDistance });

  const signalMin = Math.min(...smoothed);
  const signalMax = Math.max(...smoothed);
  const signalRange = signalMax - signalMin;

  // Setup/walkout filter: drop the first peak if it's in the initial 20% of
  // the video AND much smaller than the median peak height. Setup dips
  // (positioning under the bar, unracking) look like shallow peaks.
  let peaks = allPeaks;
  if (allPeaks.length >= 3 && allPeaks[0] < smoothed.length * 0.20) {
    const peakValues = allPeaks.map((idx) => smoothed[idx]);
    const sorted = [...peakValues].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const firstRelative = peakValues[0] - signalMin;
    const medianRelative = median - signalMin;
    if (medianRelative > 0 && firstRelative / medianRelative < 0.5) {
      peaks = allPeaks.slice(1);
    }
  }

  // Log for debugging
  const preview = smoothed.slice(0, 20).map((v) => v.toFixed(3)).join(', ');
  console.log(`[reps] signal range: ${signalMin.toFixed(4)}–${signalMax.toFixed(4)} (delta=${signalRange.toFixed(4)}), raw peaks: ${allPeaks.length}, after walkout filter: ${peaks.length}`);
  console.log(`[reps] peak indices: [${allPeaks.join(', ')}], peak values: [${allPeaks.map((p) => smoothed[p].toFixed(3)).join(', ')}]`);
  console.log(`[reps] FULL SIGNAL: [${smoothed.map((v) => v.toFixed(4)).join(',')}]`);

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
