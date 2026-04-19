import { computeAngle } from './angle-calculator';
import { LANDMARK, type PoseFrame } from './pose-types';

/** Minimum time between peaks — prevents double-detection on a single rep. */
const MIN_PEAK_TIME_SEC = 0.8;

// Deadlift-specific state-machine thresholds. Hip angle is the hinge joint.
// Floor (bar on ground): deep hinge, hip angle well below 120°.
// Lockout (extended): hip angle approaching 180°.
// The lifter is "in transit" between these — neither counted nor reset.
// A rep completes when a FLOOR → LOCKOUT transition is observed AND lockout
// is held for at least MIN_LOCKOUT_HOLD_SEC. That sustain-hold filter is what
// kills single-frame MediaPipe noise spikes that otherwise masquerade as reps.
const DEADLIFT_FLOOR_HIP_DEG = 143;
// Lockout threshold. A lifter who "just stood up with the bar" post-set can
// hit the high 150s briefly — observed in dl-2-reps-side end frames. Real
// rep lockouts in calibrated fixtures consistently hit 165+ on the visible
// frame. Sitting the threshold at 162 keeps the phantom post-set stand-up
// out while still catching marginal lockouts on longer sets.
const DEADLIFT_LOCKOUT_HIP_DEG = 162;
// At 4fps most real lockouts are visible on a single frame. Requiring two
// consecutive frames misses the full concentric of fast deadlifts; requiring
// just one leaves us vulnerable to noise spikes — which is why the lockout
// threshold above is tight. Also demand that the lockout frame be preceded
// by evidence of ascent (checked in the detector loop), so a single-frame
// spike surrounded by floor values doesn't count.
const DEADLIFT_MIN_LOCKOUT_HOLD_SEC = 0;
/** Smoothing window target time — matches the ~233ms used at 30fps (7/30). */
const SMOOTH_TIME_SEC = 7 / 30;
/** Minimum number of valid angle frames to use angle-based detection. */
const MIN_ANGLE_FRAMES = 3;

/** Extract the Y-coordinate signal used for rep detection based on lift type. */
function extractYSignal({
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

/**
 * Extract a viewpoint-invariant joint angle signal for rep detection.
 *
 * Joint angles oscillate with reps regardless of camera angle:
 *   - Squat: knee angle (hip-knee-ankle). Standing ≈ 170°, bottom ≈ 70-90°.
 *   - Deadlift: hip angle (shoulder-hip-knee). Standing ≈ 170°, floor ≈ 70-90°.
 *   - Bench: elbow angle (shoulder-elbow-wrist). Lockout ≈ 170°, chest ≈ 50-70°.
 *
 * Returns INVERTED angles (180 - angle) so that peaks correspond to rep bottoms,
 * matching the convention of the Y-coordinate signal (higher = deeper).
 *
 * Returns null if too few frames have visible landmarks for angle computation.
 */
function extractAngleSignal({
  frames,
  lift,
}: {
  frames: PoseFrame[];
  lift: 'squat' | 'bench' | 'deadlift';
}): number[] | null {
  const VIS_THRESHOLD = 0.5;
  let validCount = 0;

  const signal = frames.map((frame) => {
    if (lift === 'bench') {
      const ls = frame[LANDMARK.LEFT_SHOULDER];
      const rs = frame[LANDMARK.RIGHT_SHOULDER];
      const le = frame[LANDMARK.LEFT_ELBOW];
      const re = frame[LANDMARK.RIGHT_ELBOW];
      const lw = frame[LANDMARK.LEFT_WRIST];
      const rw = frame[LANDMARK.RIGHT_WRIST];

      // Need at least one side visible
      const leftVis =
        ls.visibility >= VIS_THRESHOLD &&
        le.visibility >= VIS_THRESHOLD &&
        lw.visibility >= VIS_THRESHOLD;
      const rightVis =
        rs.visibility >= VIS_THRESHOLD &&
        re.visibility >= VIS_THRESHOLD &&
        rw.visibility >= VIS_THRESHOLD;

      if (!leftVis && !rightVis) return 0;
      validCount++;

      let angle = 0;
      let sides = 0;
      if (leftVis) {
        angle += computeAngle({ a: ls, b: le, c: lw });
        sides++;
      }
      if (rightVis) {
        angle += computeAngle({ a: rs, b: re, c: rw });
        sides++;
      }
      // Invert: 180 - angle → peaks at rep bottom (smallest angle = largest inverted)
      return 180 - angle / sides;
    }

    if (lift === 'deadlift') {
      // Deadlift: hip angle (shoulder-hip-knee) — primary hinge joint.
      // Standing ≈ 170°, floor position ≈ 70-90°. Clearer signal than knee angle
      // because the deadlift is hip-dominant.
      const ls = frame[LANDMARK.LEFT_SHOULDER];
      const rs = frame[LANDMARK.RIGHT_SHOULDER];
      const lh = frame[LANDMARK.LEFT_HIP];
      const rh = frame[LANDMARK.RIGHT_HIP];
      const lk = frame[LANDMARK.LEFT_KNEE];
      const rk = frame[LANDMARK.RIGHT_KNEE];

      const leftVis =
        ls.visibility >= VIS_THRESHOLD &&
        lh.visibility >= VIS_THRESHOLD &&
        lk.visibility >= VIS_THRESHOLD;
      const rightVis =
        rs.visibility >= VIS_THRESHOLD &&
        rh.visibility >= VIS_THRESHOLD &&
        rk.visibility >= VIS_THRESHOLD;

      if (!leftVis && !rightVis) return 0;
      validCount++;

      let angle = 0;
      let sides = 0;
      if (leftVis) {
        angle += computeAngle({ a: ls, b: lh, c: lk });
        sides++;
      }
      if (rightVis) {
        angle += computeAngle({ a: rs, b: rh, c: rk });
        sides++;
      }
      return 180 - angle / sides;
    }

    // Squat: knee angle (hip-knee-ankle)
    // Standing ≈ 170°, bottom ≈ 70-90°.
    const lh = frame[LANDMARK.LEFT_HIP];
    const rh = frame[LANDMARK.RIGHT_HIP];
    const lk = frame[LANDMARK.LEFT_KNEE];
    const rk = frame[LANDMARK.RIGHT_KNEE];
    const la = frame[LANDMARK.LEFT_ANKLE];
    const ra = frame[LANDMARK.RIGHT_ANKLE];

    const leftVis =
      lh.visibility >= VIS_THRESHOLD &&
      lk.visibility >= VIS_THRESHOLD &&
      la.visibility >= VIS_THRESHOLD;
    const rightVis =
      rh.visibility >= VIS_THRESHOLD &&
      rk.visibility >= VIS_THRESHOLD &&
      ra.visibility >= VIS_THRESHOLD;

    if (!leftVis && !rightVis) return 0;
    validCount++;

    let angle = 0;
    let sides = 0;
    if (leftVis) {
      angle += computeAngle({ a: lh, b: lk, c: la });
      sides++;
    }
    if (rightVis) {
      angle += computeAngle({ a: rh, b: rk, c: ra });
      sides++;
    }
    return 180 - angle / sides;
  });

  return validCount >= MIN_ANGLE_FRAMES ? signal : null;
}

/**
 * Check if an angle signal has enough range to detect reps.
 * A flat angle signal (e.g., from frames where joints don't move) should
 * fall back to Y-coordinate detection.
 */
function hasUsableRange(signal: number[]): boolean {
  const nonZero = signal.filter((v) => v > 1.0);
  if (nonZero.length < 3) return false;
  const min = Math.min(...nonZero);
  const max = Math.max(...nonZero);
  return max - min > 5.0; // need at least 5° range to be useful
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
 * Extract the RAW (un-inverted) hip angle per frame for deadlift state-machine
 * rep detection. Returns NaN for frames where neither side is visible.
 */
function extractHipAngles({ frames }: { frames: PoseFrame[] }): number[] {
  const VIS_THRESHOLD = 0.5;
  return frames.map((frame) => {
    const ls = frame[LANDMARK.LEFT_SHOULDER];
    const rs = frame[LANDMARK.RIGHT_SHOULDER];
    const lh = frame[LANDMARK.LEFT_HIP];
    const rh = frame[LANDMARK.RIGHT_HIP];
    const lk = frame[LANDMARK.LEFT_KNEE];
    const rk = frame[LANDMARK.RIGHT_KNEE];

    const leftVis =
      ls.visibility >= VIS_THRESHOLD &&
      lh.visibility >= VIS_THRESHOLD &&
      lk.visibility >= VIS_THRESHOLD;
    const rightVis =
      rs.visibility >= VIS_THRESHOLD &&
      rh.visibility >= VIS_THRESHOLD &&
      rk.visibility >= VIS_THRESHOLD;

    if (!leftVis && !rightVis) return NaN;

    let angle = 0;
    let sides = 0;
    if (leftVis) {
      angle += computeAngle({ a: ls, b: lh, c: lk });
      sides++;
    }
    if (rightVis) {
      angle += computeAngle({ a: rs, b: rh, c: rk });
      sides++;
    }
    return angle / sides;
  });
}

/**
 * State-machine rep detector for deadlift.
 *
 * A rep is a FLOOR → LOCKOUT cycle where lockout is held for at least
 * `DEADLIFT_MIN_LOCKOUT_HOLD_SEC`. Holding the lockout hip angle for a beat
 * is the robust signal that distinguishes a real rep from landmark noise —
 * MediaPipe will sometimes report a single-frame hip angle of 155–175° mid-
 * concentric because of limb occlusion or torso jitter, but it almost never
 * sustains that artifact across two or more consecutive frames.
 *
 * `startFrame` of each rep is the most recent frame at which the lifter was
 * clearly at floor (hip < `DEADLIFT_FLOOR_HIP_DEG`) before the concentric.
 * `endFrame` is the last frame of the sustained lockout hold.
 *
 * Returns `null` if fewer than MIN_ANGLE_FRAMES of hip data are visible, so
 * the caller can fall back to peak-based detection.
 */
function detectDeadliftReps({
  frames,
  fps,
}: {
  frames: PoseFrame[];
  fps: number;
}): { startFrame: number; endFrame: number }[] | null {
  const rawHipAngles = extractHipAngles({ frames });
  const validCount = rawHipAngles.filter((h) => !Number.isNaN(h)).length;
  if (validCount < MIN_ANGLE_FRAMES) return null;

  // Linearly interpolate short NaN gaps so the state machine doesn't skip
  // frames where MediaPipe briefly lost the hip — common at 45° views where
  // one side of the body is occluded by the bar. Long gaps stay NaN and are
  // skipped in the main loop.
  const MAX_INTERP_GAP = Math.max(2, Math.round(fps * 0.5));
  const hipAngles = [...rawHipAngles];
  for (let i = 0; i < hipAngles.length; i++) {
    if (!Number.isNaN(hipAngles[i])) continue;
    let prev = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (!Number.isNaN(rawHipAngles[j])) {
        prev = j;
        break;
      }
    }
    let next = -1;
    for (let j = i + 1; j < hipAngles.length; j++) {
      if (!Number.isNaN(rawHipAngles[j])) {
        next = j;
        break;
      }
    }
    if (prev < 0 || next < 0) continue;
    if (next - prev > MAX_INTERP_GAP) continue;
    const t = (i - prev) / (next - prev);
    hipAngles[i] = rawHipAngles[prev] * (1 - t) + rawHipAngles[next] * t;
  }

  const reps: { startFrame: number; endFrame: number }[] = [];

  // State machine:
  //   WAITING_FOR_FLOOR  — we need a clear floor touch before the next rep.
  //   WAITING_FOR_LOCKOUT — lifter has been at floor; watch for lockout.
  // We never rewind from LOCKOUT directly to another LOCKOUT without a floor
  // touch in between; that's what suppresses phantom reps on the eccentric.
  let state: 'WAITING_FOR_FLOOR' | 'WAITING_FOR_LOCKOUT' =
    'WAITING_FOR_FLOOR';
  // First floor frame of the *current* rep's setup — used as the rep's
  // startFrame so metrics get the full concentric window (setup → lockout),
  // not just the last floor-ish noise spike before the lockout.
  let repStartFloorFrame = -1;

  // Spike-filter window: if a single-frame lockout is surrounded by floor
  // values (immediately before AND within a handful of frames after), treat
  // it as a MediaPipe detection glitch rather than a real rep. Real rep
  // lockouts are held for >= ~0.25s OR followed by transit/descent.
  const spikeLookaheadFrames = Math.max(2, Math.round(fps * 0.3));

  for (let i = 0; i < hipAngles.length; i++) {
    const hip = hipAngles[i];
    if (Number.isNaN(hip)) continue;

    const isFloor = hip < DEADLIFT_FLOOR_HIP_DEG;
    const isLockout = hip > DEADLIFT_LOCKOUT_HIP_DEG;

    if (isFloor) {
      if (state === 'WAITING_FOR_FLOOR') {
        repStartFloorFrame = i;
        state = 'WAITING_FOR_LOCKOUT';
      }
      // Already WAITING_FOR_LOCKOUT — keep repStartFloorFrame anchored at
      // the beginning of the current floor cluster so the rep window spans
      // the full setup.
      continue;
    }

    if (state !== 'WAITING_FOR_LOCKOUT') continue;
    if (!isLockout) continue;
    if (repStartFloorFrame < 0) continue;

    // Minimum consecutive-frame hold, if configured.
    const minHoldFrames = Math.max(
      1,
      Math.round(fps * DEADLIFT_MIN_LOCKOUT_HOLD_SEC)
    );
    if (minHoldFrames > 1) {
      let held = 1;
      for (let j = i + 1; j < hipAngles.length && held < minHoldFrames; j++) {
        const h = hipAngles[j];
        if (Number.isNaN(h)) continue;
        if (h <= DEADLIFT_LOCKOUT_HIP_DEG) break;
        held++;
      }
      if (held < minHoldFrames) continue;
    }

    // Spike filter: the first visible non-NaN frame in the next small window
    // must NOT be floor. A LOCKOUT → FLOOR transition on adjacent visible
    // frames is almost always MediaPipe swapping the hip landmark with a
    // different joint for one frame. Real reps descend gradually through
    // transit.
    let isSpike = true;
    for (
      let j = i + 1;
      j < Math.min(hipAngles.length, i + 1 + spikeLookaheadFrames);
      j++
    ) {
      const h = hipAngles[j];
      if (Number.isNaN(h)) continue;
      isSpike = h < DEADLIFT_FLOOR_HIP_DEG;
      break;
    }
    if (isSpike) continue;

    reps.push({ startFrame: repStartFloorFrame, endFrame: i });
    state = 'WAITING_FOR_FLOOR';
  }

  // Eccentric-evidence filter. When the lifter is already at lockout and the
  // recording ends before the eccentric (bar lowering, hip returning to
  // floor) is visible, the detector can't distinguish "final rep then stop"
  // from "stood up post-set to put the bar away". Per calibration across
  // our fixtures, the extra rep is always the final detected lockout with
  // no FLOOR signal afterwards. Filter it out — but only if we have other
  // reps, so a legitimate cut-at-lockout single-rep video isn't zeroed.
  if (reps.length > 1) {
    const last = reps[reps.length - 1];
    let hasEccentric = false;
    for (let j = last.endFrame + 1; j < hipAngles.length; j++) {
      const h = hipAngles[j];
      if (Number.isNaN(h)) continue;
      if (h < DEADLIFT_FLOOR_HIP_DEG) {
        hasEccentric = true;
        break;
      }
    }
    if (!hasEccentric) reps.pop();
  }

  return reps;
}

/**
 * Detect rep boundaries from joint angle periodicity (viewpoint-invariant).
 *
 * Primary signal: joint angles (knee for squat/DL, elbow for bench) oscillate
 * with reps regardless of camera angle. Falls back to Y-coordinate method
 * when landmarks are not visible enough for angle computation.
 *
 * Each rep is bounded by the valleys between consecutive bottom-of-rep peaks.
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

  // Deadlift: use a hip-angle state machine. Much more robust than peak
  // counting on the inverted-hip signal, which picks up every landmark-
  // noise dip as a phantom rep. Falls back to peak-based if hip angles
  // aren't visible enough (e.g. front-camera partial occlusion).
  if (lift === 'deadlift') {
    const smReps = detectDeadliftReps({ frames, fps });
    if (smReps != null) return smReps;
  }

  // Try viewpoint-invariant angle signal first, fall back to Y-coordinate.
  // Angle signals are in degrees (0-180); need sufficient range to be useful.
  const angleSignal = extractAngleSignal({ frames, lift });
  const useAngle = angleSignal != null && hasUsableRange(angleSignal);
  const raw = useAngle ? angleSignal : extractYSignal({ frames, lift });
  const smoothed = smoothSignal({ signal: raw, windowSize: smoothWindow });
  const allPeaks = findPeaks({
    signal: smoothed,
    minDistance: minPeakDistance,
  });

  // Compute signal range from non-zero values only — empty/interpolated frames
  // have Y=0 (or angle=0 for invisible landmarks) which inflates the range.
  const isAngleSignal = useAngle;
  // Angle signals are in degrees (0-180); Y signals are normalized (0-1).
  const zeroThreshold = isAngleSignal ? 1.0 : 0.01;
  const flatThreshold = isAngleSignal ? 2.0 : 0.005;

  const nonZero = smoothed.filter((v) => v > zeroThreshold);
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
    if (signalRange < flatThreshold) return false; // flat signal — no real reps

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

  // Post-filter: drop reps whose window contains no real joint flexion.
  // Rationale — for squat/bench, the peak-based detector can include setup
  // walkouts (first rep) or rack-up tails (last rep) as extra reps because
  // their boundaries span from the video edge to the first real valley. A
  // real squat/bench rep has a moment of deep flexion somewhere inside its
  // window; walkout/racking phases never reach it. We only apply this to
  // lifts that use the angle signal (otherwise we have no reliable way to
  // judge flexion).
  if (useAngle && angleSignal != null) {
    // inverted angle threshold ≈ joint flexed to ≤ 120°. Real squat/bench
    // bottoms reach 85°+ easily (deeper = larger inverted); this is loose
    // enough to not drop marginal reps but tight enough to exclude rack-up
    // and walkout wobbles that barely dip.
    const MIN_FLEXION_SIGNAL = 60;
    return reps.filter((r) => {
      let maxFlexion = 0;
      for (let j = r.startFrame; j <= r.endFrame; j++) {
        if (angleSignal[j] > maxFlexion) maxFlexion = angleSignal[j];
      }
      return maxFlexion >= MIN_FLEXION_SIGNAL;
    });
  }

  return reps;
}
