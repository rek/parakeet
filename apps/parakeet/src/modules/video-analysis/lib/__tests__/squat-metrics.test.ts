import { describe, expect, it } from 'vitest';

import { detectButtWink } from '../butt-wink-detector';
import { computeHipShift } from '../hip-shift';
import { LANDMARK, type PoseFrame, type PoseLandmark } from '../pose-types';
import { computeStanceWidth } from '../stance-width';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLandmark(x: number, y: number): PoseLandmark {
  return { x, y, z: 0, visibility: 1 };
}

function makeFrame(overrides: Record<number, PoseLandmark>): PoseFrame {
  const frame: PoseFrame = Array.from({ length: 33 }, () =>
    makeLandmark(0.5, 0.5)
  );
  for (const [idx, lm] of Object.entries(overrides)) {
    frame[Number(idx)] = lm;
  }
  return frame;
}

// ---------------------------------------------------------------------------
// detectButtWink
// ---------------------------------------------------------------------------

describe('detectButtWink', () => {
  const fps = 30;
  // framesFor200ms = ceil(30 * 0.2) = 6

  /**
   * Build a frame sequence where hip angle decreases gradually from
   * startAngle to endAngle across frameCount frames.
   *
   * Hip angle (shoulder-hip-knee) is manipulated by moving the shoulder X
   * while keeping hip and knee fixed. The angle at the hip vertex opens as
   * the shoulder moves away horizontally.
   */
  function makeAngleFrames({
    frameCount,
    startHipAngle,
    endHipAngle,
  }: {
    frameCount: number;
    startHipAngle: number;
    endHipAngle: number;
  }): PoseFrame[] {
    // We place hip at (0.5, 0.6) and knee at (0.5, 0.8) (directly below).
    // Shoulder X controls the hip-vertex angle. With shoulder directly above
    // hip, the angle is 180°. Moving shoulder horizontally closes the angle.
    // Angle = atan2(|cross|, dot) where vectors are shoulder→hip and knee→hip.
    //
    // Using a simple linear interpolation on shoulder X offset to produce
    // predictable angle changes: larger X offset = smaller angle.
    // At offset=0: shoulder is directly above hip → angle=180°
    // We compute the required X offset for a target angle using trigonometry:
    //   angle = atan2(hipToKnee_y * shoulderOffset, -(hipToKnee_y * hipToShoulder_y))
    //   simplified for this geometry:
    //     a=shoulder→hip, c=knee→hip
    //     a = (hipX-shoulderX, hipY-shoulderY) = (-offset, 0.35)  [hip at 0.6, shoulder at 0.25]
    //     c = (hipX-kneeX, hipY-kneeY) = (0, -0.2)               [knee at 0.8, hip at 0.6]
    //     dot = (-offset)*0 + 0.35*(-0.2) = -0.07
    //     cross = (-offset)*(-0.2) - 0.35*0 = 0.2*offset
    //     angle = atan2(|0.2*offset|, -0.07) — but computeAngle uses atan2(|cross|, dot)
    //
    // So angle = atan2(0.2*offset, -0.07) in radians, converted to degrees.
    // Inverting: offset = tan(angle_rad) * (-0.07) / 0.2
    // For angle > 90°, dot < 0, atan2 returns values in (90°, 180°].
    //
    // This geometry gives angles in (90°, 180°] which matches real squat hip angles.
    const frames: PoseFrame[] = [];

    for (let i = 0; i < frameCount; i++) {
      const t = frameCount > 1 ? i / (frameCount - 1) : 0;
      const targetAngleDeg = startHipAngle + (endHipAngle - startHipAngle) * t;
      const targetAngleRad = (targetAngleDeg * Math.PI) / 180;

      // offset = tan(angle_rad) * 0.07 / 0.2 (keeping |dot| = 0.07)
      const offset = (Math.tan(targetAngleRad) * 0.07) / 0.2;
      const shoulderX = 0.5 - Math.abs(offset);

      frames.push(
        makeFrame({
          [LANDMARK.LEFT_SHOULDER]: makeLandmark(shoulderX, 0.25),
          [LANDMARK.RIGHT_SHOULDER]: makeLandmark(shoulderX, 0.25),
          [LANDMARK.LEFT_HIP]: makeLandmark(0.5, 0.6),
          [LANDMARK.RIGHT_HIP]: makeLandmark(0.5, 0.6),
          [LANDMARK.LEFT_KNEE]: makeLandmark(0.5, 0.8),
          [LANDMARK.RIGHT_KNEE]: makeLandmark(0.5, 0.8),
        })
      );
    }

    return frames;
  }

  it('returns detected=false for a clean squat with gradual hip flexion', () => {
    // 21 frames total, bottomFrame=20. Descent window = frames 14..20 (7 frames).
    // Angle drops slowly from 160° to 145°: 15° over 7 frames — spread across all.
    // Max angle is at frame 14 (start of window), framesFromMaxToBottom = 6.
    // framesFor200ms = 6. Condition is < 6, so 6 is NOT < 6 → detected=false.
    const descentFrames = makeAngleFrames({
      frameCount: 21,
      startHipAngle: 175,
      endHipAngle: 145,
    });

    const result = detectButtWink({
      frames: descentFrames,
      bottomFrame: 20,
      fps,
    });

    expect(result.detected).toBe(false);
    expect(result.magnitudeDeg).toBeNull();
    expect(result.frameIndex).toBeNull();
  });

  it('returns detected=true with magnitudeDeg > 10 for a sharp late-descent wink', () => {
    // 31 frames total, bottomFrame=30. Descent window = frames 21..30 (9 frames).
    // framesFor200ms = ceil(30 * 0.2) = 6.
    //
    // Angle profile in window: rises to a local peak at frame 27 (~165°) then
    // drops sharply to ~128° at frame 30. This mimics the classic butt-wink
    // pattern where the lifter reaches max depth control then the pelvis tucks.
    // maxAngleFrame=27, framesFromMaxToBottom=3 < 6 ✓, magnitudeDeg≈37° > 10° ✓
    const frames: PoseFrame[] = [];

    // Frames 0..24: gradual descent, angle decreasing from 175° to 150°
    const earlyFrames = makeAngleFrames({
      frameCount: 25,
      startHipAngle: 175,
      endHipAngle: 150,
    });
    frames.push(...earlyFrames);

    // Frames 25..27: slight hip opening as lifter reaches depth control (150° → 165°)
    const riseFrames = makeAngleFrames({
      frameCount: 3,
      startHipAngle: 150,
      endHipAngle: 165,
    });
    frames.push(...riseFrames);

    // Frames 28..30: sharp pelvic tuck — 37° drop in 3 frames
    const winkFrames = makeAngleFrames({
      frameCount: 3,
      startHipAngle: 165,
      endHipAngle: 128,
    });
    frames.push(...winkFrames);

    const result = detectButtWink({ frames, bottomFrame: 30, fps });

    expect(result.detected).toBe(true);
    expect(result.magnitudeDeg).not.toBeNull();
    expect(result.magnitudeDeg!).toBeGreaterThan(10);
  });

  it('returns detected=false when the drop is large but too slow (spread over entire window)', () => {
    // bottomFrame=20, window=14..20. Angle drops 20° across all 7 frames of the window.
    // Max is at frame 14, framesFromMaxToBottom=6. 6 is NOT < 6 → detected=false,
    // even though 20° > 10°. Slow progressive flexion is not butt wink.
    const frames = makeAngleFrames({
      frameCount: 21,
      startHipAngle: 165,
      endHipAngle: 130,
    });

    const result = detectButtWink({ frames, bottomFrame: 20, fps });

    expect(result.detected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeStanceWidth
// ---------------------------------------------------------------------------

describe('computeStanceWidth', () => {
  it('returns a small width for a narrow stance', () => {
    // Ankles 0.04 normalized units apart → ~9.72cm
    const frame = makeFrame({
      [LANDMARK.LEFT_ANKLE]: makeLandmark(0.48, 0.95),
      [LANDMARK.RIGHT_ANKLE]: makeLandmark(0.52, 0.95),
    });

    const width = computeStanceWidth({ frame });

    expect(width).toBeCloseTo(0.04 * 243, 1);
    expect(width).toBeLessThan(15);
  });

  it('returns a large width for a wide stance', () => {
    // Ankles 0.30 normalized units apart → ~72.9cm
    const frame = makeFrame({
      [LANDMARK.LEFT_ANKLE]: makeLandmark(0.2, 0.95),
      [LANDMARK.RIGHT_ANKLE]: makeLandmark(0.8, 0.95),
    });

    const width = computeStanceWidth({ frame });

    expect(width).toBeCloseTo(0.6 * 243, 1);
    expect(width).toBeGreaterThan(50);
  });

  it('returns zero for coincident ankles', () => {
    const frame = makeFrame({
      [LANDMARK.LEFT_ANKLE]: makeLandmark(0.5, 0.95),
      [LANDMARK.RIGHT_ANKLE]: makeLandmark(0.5, 0.95),
    });

    expect(computeStanceWidth({ frame })).toBeCloseTo(0, 5);
  });

  it('uses absolute value — result is positive regardless of landmark order', () => {
    const frameA = makeFrame({
      [LANDMARK.LEFT_ANKLE]: makeLandmark(0.3, 0.95),
      [LANDMARK.RIGHT_ANKLE]: makeLandmark(0.7, 0.95),
    });
    const frameB = makeFrame({
      [LANDMARK.LEFT_ANKLE]: makeLandmark(0.7, 0.95),
      [LANDMARK.RIGHT_ANKLE]: makeLandmark(0.3, 0.95),
    });

    expect(computeStanceWidth({ frame: frameA })).toBeCloseTo(
      computeStanceWidth({ frame: frameB }),
      5
    );
  });
});

// ---------------------------------------------------------------------------
// computeHipShift
// ---------------------------------------------------------------------------

describe('computeHipShift', () => {
  function makeSymmetricFrames(count: number): PoseFrame[] {
    return Array.from({ length: count }, () =>
      makeFrame({
        [LANDMARK.LEFT_HIP]: makeLandmark(0.47, 0.6),
        [LANDMARK.RIGHT_HIP]: makeLandmark(0.53, 0.6),
      })
    );
  }

  it('returns direction=none for a symmetric squat', () => {
    const frames = makeSymmetricFrames(10);
    const result = computeHipShift({ frames, startFrame: 0, endFrame: 9 });

    expect(result.direction).toBe('none');
    expect(result.maxShiftCm).toBeCloseTo(0, 5);
  });

  it('returns direction=left when the left hip drops below the right', () => {
    // In MediaPipe, Y increases downward. Left hip dropping = leftHip.y > rightHip.y.
    // Shift = (0.65 - 0.55) * 243 = 24.3cm > 1cm threshold.
    const frames = [
      makeFrame({
        [LANDMARK.LEFT_HIP]: makeLandmark(0.47, 0.65),
        [LANDMARK.RIGHT_HIP]: makeLandmark(0.53, 0.55),
      }),
    ];

    const result = computeHipShift({ frames, startFrame: 0, endFrame: 0 });

    expect(result.direction).toBe('left');
    expect(result.maxShiftCm).toBeGreaterThan(1);
  });

  it('returns direction=right when the right hip drops below the left', () => {
    // Right hip dropping = rightHip.y > leftHip.y → leftHip.y - rightHip.y < 0.
    const frames = [
      makeFrame({
        [LANDMARK.LEFT_HIP]: makeLandmark(0.47, 0.55),
        [LANDMARK.RIGHT_HIP]: makeLandmark(0.53, 0.65),
      }),
    ];

    const result = computeHipShift({ frames, startFrame: 0, endFrame: 0 });

    expect(result.direction).toBe('right');
    expect(result.maxShiftCm).toBeGreaterThan(1);
  });

  it('returns direction=none for sub-threshold asymmetry (noise floor)', () => {
    // 0.003 normalized units ≈ 0.73cm — below the 1cm threshold.
    const frames = [
      makeFrame({
        [LANDMARK.LEFT_HIP]: makeLandmark(0.47, 0.603),
        [LANDMARK.RIGHT_HIP]: makeLandmark(0.53, 0.6),
      }),
    ];

    const result = computeHipShift({ frames, startFrame: 0, endFrame: 0 });

    expect(result.direction).toBe('none');
  });

  it('reports the maximum shift across all frames in the range', () => {
    const frames = [
      // Frame 0: small shift
      makeFrame({
        [LANDMARK.LEFT_HIP]: makeLandmark(0.47, 0.61),
        [LANDMARK.RIGHT_HIP]: makeLandmark(0.53, 0.6),
      }),
      // Frame 1: large shift
      makeFrame({
        [LANDMARK.LEFT_HIP]: makeLandmark(0.47, 0.7),
        [LANDMARK.RIGHT_HIP]: makeLandmark(0.53, 0.6),
      }),
      // Frame 2: medium shift
      makeFrame({
        [LANDMARK.LEFT_HIP]: makeLandmark(0.47, 0.65),
        [LANDMARK.RIGHT_HIP]: makeLandmark(0.53, 0.6),
      }),
    ];

    const result = computeHipShift({ frames, startFrame: 0, endFrame: 2 });

    // Max is frame 1: (0.70 - 0.60) * 243 = 24.3cm
    expect(result.maxShiftCm).toBeCloseTo(0.1 * 243, 1);
    expect(result.direction).toBe('left');
  });
});
