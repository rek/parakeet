import { describe, expect, it } from 'vitest';

import type { RepAnalysis, BarPathPoint } from '@parakeet/shared-types';

import {
  gradeSquatRep,
  gradeBenchRep,
  gradeDeadliftRep,
  gradeRep,
} from '../competition-grader';
import type { RepVerdict } from '../competition-grader';
import { LANDMARK } from '../pose-types';
import { buildFrame } from './fixtures';

// Helper to build a minimal rep with defaults
function makeRep(overrides: Partial<RepAnalysis> = {}): RepAnalysis {
  return {
    repNumber: 1,
    startFrame: 0,
    endFrame: 29,
    barPath: Array.from({ length: 30 }, (_, i) => ({ x: 0.5, y: 0.4 + Math.sin(i / 30 * Math.PI) * 0.15, frame: i })),
    faults: [],
    ...overrides,
  };
}

// Standing frame with knees fully extended (good lockout)
function standingFrame() {
  return buildFrame({
    [LANDMARK.LEFT_KNEE]: { x: 0.46, y: 0.75, z: 0, visibility: 1 },
    [LANDMARK.RIGHT_KNEE]: { x: 0.54, y: 0.75, z: 0, visibility: 1 },
    [LANDMARK.LEFT_ANKLE]: { x: 0.46, y: 0.95, z: 0, visibility: 1 },
    [LANDMARK.RIGHT_ANKLE]: { x: 0.54, y: 0.95, z: 0, visibility: 1 },
    [LANDMARK.LEFT_HIP]: { x: 0.47, y: 0.50, z: 0, visibility: 1 },
    [LANDMARK.RIGHT_HIP]: { x: 0.53, y: 0.50, z: 0, visibility: 1 },
    [LANDMARK.LEFT_SHOULDER]: { x: 0.46, y: 0.25, z: 0, visibility: 1 },
    [LANDMARK.RIGHT_SHOULDER]: { x: 0.54, y: 0.25, z: 0, visibility: 1 },
  });
}

// Bent-knee frame (incomplete lockout — ~140° knee angle)
function bentKneeFrame() {
  return buildFrame({
    [LANDMARK.LEFT_KNEE]: { x: 0.42, y: 0.72, z: 0, visibility: 1 },
    [LANDMARK.RIGHT_KNEE]: { x: 0.58, y: 0.72, z: 0, visibility: 1 },
    [LANDMARK.LEFT_ANKLE]: { x: 0.46, y: 0.95, z: 0, visibility: 1 },
    [LANDMARK.RIGHT_ANKLE]: { x: 0.54, y: 0.95, z: 0, visibility: 1 },
    [LANDMARK.LEFT_HIP]: { x: 0.47, y: 0.50, z: 0, visibility: 1 },
    [LANDMARK.RIGHT_HIP]: { x: 0.53, y: 0.50, z: 0, visibility: 1 },
  });
}

function makeFrames(count: number, frameFn = standingFrame) {
  return Array.from({ length: count }, () => frameFn());
}

describe('gradeSquatRep', () => {
  it('passes depth when well below parallel', () => {
    const rep = makeRep({ maxDepthCm: 5 });
    const frames = makeFrames(30);
    const verdict = gradeSquatRep({ rep, frames });
    const depth = verdict.criteria.find((c) => c.name === 'depth');
    expect(depth?.verdict).toBe('pass');
  });

  it('borderline depth when just at parallel', () => {
    const rep = makeRep({ maxDepthCm: 1 });
    const frames = makeFrames(30);
    const verdict = gradeSquatRep({ rep, frames });
    const depth = verdict.criteria.find((c) => c.name === 'depth');
    expect(depth?.verdict).toBe('borderline');
  });

  it('fails depth when above parallel', () => {
    const rep = makeRep({ maxDepthCm: -2 });
    const frames = makeFrames(30);
    const verdict = gradeSquatRep({ rep, frames });
    const depth = verdict.criteria.find((c) => c.name === 'depth');
    expect(depth?.verdict).toBe('fail');
  });

  it('passes lockout with full knee extension', () => {
    const frames = makeFrames(30, standingFrame);
    const rep = makeRep({ maxDepthCm: -5, endFrame: 29 });
    const verdict = gradeSquatRep({ rep, frames });
    const lockout = verdict.criteria.find((c) => c.name === 'lockout');
    expect(lockout?.verdict).toBe('pass');
  });

  it('fails lockout with bent knees', () => {
    const frames = makeFrames(30, bentKneeFrame);
    const rep = makeRep({ maxDepthCm: -5, kneeAngleDeg: 140, endFrame: 29 });
    const verdict = gradeSquatRep({ rep, frames });
    const lockout = verdict.criteria.find((c) => c.name === 'lockout');
    expect(lockout?.verdict).toBe('fail');
  });

  it('overall verdict is red_light when any criterion fails', () => {
    const rep = makeRep({ maxDepthCm: -3 }); // above parallel = fail
    const frames = makeFrames(30);
    const verdict = gradeSquatRep({ rep, frames });
    expect(verdict.verdict).toBe('red_light');
  });

  it('overall verdict is white_light when all pass', () => {
    const rep = makeRep({ maxDepthCm: 5 });
    const frames = makeFrames(30, standingFrame);
    const verdict = gradeSquatRep({ rep, frames });
    expect(verdict.verdict).toBe('white_light');
  });
});

describe('gradeDeadliftRep', () => {
  it('passes with full hip and knee lockout', () => {
    const frames = makeFrames(30, standingFrame);
    const rep = makeRep({ endFrame: 29 });
    const verdict = gradeDeadliftRep({ rep, frames });
    expect(verdict.criteria.find((c) => c.name === 'hip_lockout')?.verdict).toBe('pass');
    expect(verdict.criteria.find((c) => c.name === 'knee_lockout')?.verdict).toBe('pass');
  });

  it('fails hip lockout when hips not through', () => {
    // Hips hinged forward at ~90° — shoulders far forward of hips, knees below.
    // shoulder-hip-knee angle should compute well below 165°.
    const frames = makeFrames(30, () => buildFrame({
      [LANDMARK.LEFT_HIP]: { x: 0.50, y: 0.55, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_HIP]: { x: 0.50, y: 0.55, z: 0, visibility: 1 },
      [LANDMARK.LEFT_SHOULDER]: { x: 0.30, y: 0.55, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_SHOULDER]: { x: 0.30, y: 0.55, z: 0, visibility: 1 },
      [LANDMARK.LEFT_KNEE]: { x: 0.50, y: 0.80, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_KNEE]: { x: 0.50, y: 0.80, z: 0, visibility: 1 },
    }));
    const rep = makeRep({ endFrame: 29 });
    const verdict = gradeDeadliftRep({ rep, frames });
    expect(verdict.criteria.find((c) => c.name === 'hip_lockout')?.verdict).toBe('fail');
  });

  it('passes downward motion when bar path is monotonic', () => {
    // Monotonically decreasing Y (bar going up)
    const path: BarPathPoint[] = Array.from({ length: 30 }, (_, i) => ({
      x: 0.5,
      y: 0.8 - i * 0.01,
      frame: i,
    }));
    const rep = makeRep({ barPath: path });
    const frames = makeFrames(30, standingFrame);
    const verdict = gradeDeadliftRep({ rep, frames });
    expect(verdict.criteria.find((c) => c.name === 'downward_motion')?.verdict).toBe('pass');
  });

  it('fails downward motion when bar dips during pull', () => {
    // Bar goes up then dips ~12cm (obvious hitch) then continues
    const path: BarPathPoint[] = Array.from({ length: 30 }, (_, i) => {
      let y = 0.8 - i * 0.01;
      if (i >= 15 && i <= 18) y += 0.05; // ~12cm dip — obvious hitch
      return { x: 0.5, y, frame: i };
    });
    const rep = makeRep({ barPath: path });
    const frames = makeFrames(30, standingFrame);
    const verdict = gradeDeadliftRep({ rep, frames });
    expect(verdict.criteria.find((c) => c.name === 'downward_motion')?.verdict).toBe('fail');
  });
});

describe('gradeBenchRep', () => {
  it('passes pause when bar stalls at chest', () => {
    // Bar path with a long stall at the bottom
    const fps = 30;
    const path: BarPathPoint[] = [];
    for (let i = 0; i < 30; i++) {
      if (i < 10) path.push({ x: 0.5, y: 0.3 + i * 0.025, frame: i }); // descend
      else if (i < 22) path.push({ x: 0.5, y: 0.55, frame: i }); // stall (12 frames = 0.4s)
      else path.push({ x: 0.5, y: 0.55 - (i - 22) * 0.03, frame: i }); // ascend
    }
    const rep = makeRep({ barPath: path, endFrame: 29 });
    const frames = makeFrames(30, () => buildFrame({
      [LANDMARK.LEFT_ELBOW]: { x: 0.4, y: 0.3, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_ELBOW]: { x: 0.6, y: 0.3, z: 0, visibility: 1 },
      [LANDMARK.LEFT_WRIST]: { x: 0.38, y: 0.25, z: 0, visibility: 1 },
      [LANDMARK.RIGHT_WRIST]: { x: 0.62, y: 0.25, z: 0, visibility: 1 },
    }));
    const verdict = gradeBenchRep({ rep, frames, fps });
    expect(verdict.criteria.find((c) => c.name === 'pause')?.verdict).toBe('pass');
  });

  it('fails pause when bar bounces off chest', () => {
    const fps = 30;
    // No stall — continuous motion
    const path: BarPathPoint[] = Array.from({ length: 30 }, (_, i) => ({
      x: 0.5,
      y: i < 15 ? 0.3 + i * 0.017 : 0.55 - (i - 15) * 0.017,
      frame: i,
    }));
    const rep = makeRep({ barPath: path, endFrame: 29 });
    const frames = makeFrames(30);
    const verdict = gradeBenchRep({ rep, frames, fps });
    expect(verdict.criteria.find((c) => c.name === 'pause')?.verdict).toBe('fail');
  });
});

describe('gradeRep dispatcher', () => {
  it('dispatches to squat grader', () => {
    const rep = makeRep({ maxDepthCm: 5 });
    const frames = makeFrames(30, standingFrame);
    const verdict = gradeRep({ rep, frames, fps: 30, lift: 'squat' });
    expect(verdict.criteria.some((c) => c.name === 'depth')).toBe(true);
  });

  it('dispatches to bench grader', () => {
    const rep = makeRep();
    const frames = makeFrames(30);
    const verdict = gradeRep({ rep, frames, fps: 30, lift: 'bench' });
    expect(verdict.criteria.some((c) => c.name === 'pause')).toBe(true);
  });

  it('dispatches to deadlift grader', () => {
    const rep = makeRep();
    const frames = makeFrames(30, standingFrame);
    const verdict = gradeRep({ rep, frames, fps: 30, lift: 'deadlift' });
    expect(verdict.criteria.some((c) => c.name === 'hip_lockout')).toBe(true);
  });

  it('invariant: every rep gets exactly one verdict', () => {
    const lifts = ['squat', 'bench', 'deadlift'] as const;
    for (const lift of lifts) {
      const rep = makeRep({ maxDepthCm: 3 });
      const frames = makeFrames(30, standingFrame);
      const verdict = gradeRep({ rep, frames, fps: 30, lift });
      expect(['white_light', 'red_light', 'borderline']).toContain(verdict.verdict);
      expect(verdict.criteria.length).toBeGreaterThan(0);
    }
  });
});
