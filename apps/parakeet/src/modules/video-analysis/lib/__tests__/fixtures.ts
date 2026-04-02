import type { PoseFrame, PoseLandmark } from '../pose-types';
import { LANDMARK } from '../pose-types';

/**
 * Build a minimal PoseFrame populated with a default neutral-standing pose.
 * Overrides let individual tests set specific landmark positions.
 *
 * Default standing pose (normalized coords, side view):
 *   - Shoulders at ~y=0.25, Hips at ~y=0.55, Knees at ~y=0.75, Ankles at ~y=0.95
 *   - All landmarks have full visibility
 */
export function buildFrame(
  overrides: Partial<Record<number, Partial<PoseLandmark>>> = {}
): PoseFrame {
  // Build 33 default zero-visibility landmarks first
  const frame: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }));

  // Apply anatomically reasonable defaults for the key landmarks we use
  const defaults: Record<number, PoseLandmark> = {
    [LANDMARK.LEFT_SHOULDER]: { x: 0.45, y: 0.25, z: 0, visibility: 1 },
    [LANDMARK.RIGHT_SHOULDER]: { x: 0.55, y: 0.25, z: 0, visibility: 1 },
    [LANDMARK.LEFT_HIP]: { x: 0.47, y: 0.55, z: 0, visibility: 1 },
    [LANDMARK.RIGHT_HIP]: { x: 0.53, y: 0.55, z: 0, visibility: 1 },
    [LANDMARK.LEFT_KNEE]: { x: 0.46, y: 0.75, z: 0, visibility: 1 },
    [LANDMARK.RIGHT_KNEE]: { x: 0.54, y: 0.75, z: 0, visibility: 1 },
    [LANDMARK.LEFT_ANKLE]: { x: 0.47, y: 0.95, z: 0, visibility: 1 },
    [LANDMARK.RIGHT_ANKLE]: { x: 0.53, y: 0.95, z: 0, visibility: 1 },
    [LANDMARK.LEFT_WRIST]: { x: 0.3, y: 0.45, z: 0, visibility: 1 },
    [LANDMARK.RIGHT_WRIST]: { x: 0.7, y: 0.45, z: 0, visibility: 1 },
  };

  for (const [idx, lm] of Object.entries(defaults)) {
    frame[Number(idx)] = { ...lm };
  }

  // Apply caller overrides
  for (const [idx, partial] of Object.entries(overrides)) {
    frame[Number(idx)] = { ...frame[Number(idx)], ...partial };
  }

  return frame;
}

/**
 * Interpolate between two values using a 0-1 parameter t.
 * Used to build smooth sine-wave landmark trajectories.
 */
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Generate frames simulating squat reps.
 *
 * At standing: hips at y≈0.55 (above knees at y≈0.75)
 * At bottom:   hips at y≈0.82 (below knees — parallel depth), forward lean ~40°
 *
 * The sine wave drives hip Y. Shoulder X shifts slightly forward at the bottom
 * to simulate natural forward lean.
 */
export function generateSquatFrames({
  reps,
  framesPerRep = 60,
}: {
  reps: number;
  framesPerRep?: number;
}) {
  const frames: PoseFrame[] = [];
  const totalFrames = reps * framesPerRep;

  for (let i = 0; i < totalFrames; i++) {
    // t goes 0→1→0 once per rep. sin peak = 1 at midpoint of each rep.
    const repPhase = (i % framesPerRep) / framesPerRep;
    const t = Math.sin(repPhase * Math.PI); // 0 at start/end, 1 at bottom

    const hipY = lerp(0.55, 0.82, t); // standing → below-parallel
    const kneeY = lerp(0.75, 0.76, t); // knees stay roughly fixed
    const shoulderX = lerp(0.5, 0.42, t); // slight forward lean at bottom

    frames.push(
      buildFrame({
        [LANDMARK.LEFT_SHOULDER]: {
          x: shoulderX - 0.05,
          y: 0.28,
          z: 0,
          visibility: 1,
        },
        [LANDMARK.RIGHT_SHOULDER]: {
          x: shoulderX + 0.05,
          y: 0.28,
          z: 0,
          visibility: 1,
        },
        [LANDMARK.LEFT_HIP]: { x: 0.47, y: hipY, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_HIP]: { x: 0.53, y: hipY, z: 0, visibility: 1 },
        [LANDMARK.LEFT_KNEE]: { x: 0.44, y: kneeY, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_KNEE]: { x: 0.56, y: kneeY, z: 0, visibility: 1 },
        [LANDMARK.LEFT_WRIST]: { x: 0.38, y: 0.42, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_WRIST]: { x: 0.62, y: 0.42, z: 0, visibility: 1 },
      })
    );
  }

  return frames;
}

/**
 * Generate frames simulating bench press reps.
 *
 * At lockout: wrists at y≈0.3 (bar extended away from chest)
 * At chest:   wrists at y≈0.55 (highest Y = bar touching chest)
 */
export function generateBenchFrames({
  reps,
  framesPerRep = 60,
}: {
  reps: number;
  framesPerRep?: number;
}) {
  const frames: PoseFrame[] = [];
  const totalFrames = reps * framesPerRep;

  for (let i = 0; i < totalFrames; i++) {
    const repPhase = (i % framesPerRep) / framesPerRep;
    const t = Math.sin(repPhase * Math.PI);

    const wristY = lerp(0.3, 0.55, t); // lockout → chest touch

    frames.push(
      buildFrame({
        [LANDMARK.LEFT_WRIST]: { x: 0.38, y: wristY, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_WRIST]: { x: 0.62, y: wristY, z: 0, visibility: 1 },
      })
    );
  }

  return frames;
}

/**
 * Generate frames simulating deadlift reps.
 *
 * At standing: hips at y≈0.50 (high), extended position
 * At floor:    hips at y≈0.72 (lower, hinged forward)
 *
 * The lift starts standing, descends to floor position, then returns to standing.
 */
export function generateDeadliftFrames({
  reps,
  framesPerRep = 60,
}: {
  reps: number;
  framesPerRep?: number;
}) {
  const frames: PoseFrame[] = [];
  const totalFrames = reps * framesPerRep;

  for (let i = 0; i < totalFrames; i++) {
    const repPhase = (i % framesPerRep) / framesPerRep;
    const t = Math.sin(repPhase * Math.PI);

    const hipY = lerp(0.5, 0.72, t); // standing → floor position
    const shoulderX = lerp(0.5, 0.44, t); // forward hinge at floor

    frames.push(
      buildFrame({
        [LANDMARK.LEFT_SHOULDER]: {
          x: shoulderX - 0.05,
          y: 0.28,
          z: 0,
          visibility: 1,
        },
        [LANDMARK.RIGHT_SHOULDER]: {
          x: shoulderX + 0.05,
          y: 0.28,
          z: 0,
          visibility: 1,
        },
        [LANDMARK.LEFT_HIP]: { x: 0.47, y: hipY, z: 0, visibility: 1 },
        [LANDMARK.RIGHT_HIP]: { x: 0.53, y: hipY, z: 0, visibility: 1 },
        [LANDMARK.LEFT_WRIST]: {
          x: 0.5,
          y: lerp(0.7, 0.88, t),
          z: 0,
          visibility: 1,
        },
        [LANDMARK.RIGHT_WRIST]: {
          x: 0.5,
          y: lerp(0.7, 0.88, t),
          z: 0,
          visibility: 1,
        },
      })
    );
  }

  return frames;
}
