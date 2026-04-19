import { describe, expect, it } from 'vitest';

import type { BarPathPoint, RepAnalysis } from '@parakeet/shared-types';

import { findActiveRep, pickHeadDot, repColor } from '../playback-overlay-math';

const palette = ['#A', '#B', '#C', '#D', '#E', '#F'] as const;

function rep(repNumber: number, startFrame: number, endFrame: number): RepAnalysis {
  return {
    repNumber,
    startFrame,
    endFrame,
    barPath: [],
    faults: [],
  } satisfies RepAnalysis;
}

function point(frame: number, x = 0.5, y = 0.5): BarPathPoint {
  return { frame, x, y };
}

describe('repColor', () => {
  it('cycles through the palette by rep number', () => {
    expect(repColor(1, palette)).toBe(palette[0]);
    expect(repColor(2, palette)).toBe(palette[1]);
    expect(repColor(palette.length, palette)).toBe(palette[palette.length - 1]);
    expect(repColor(palette.length + 1, palette)).toBe(palette[0]);
  });

  it('handles zero/negative rep numbers gracefully', () => {
    expect(repColor(0, palette)).toBe(palette[0]);
    expect(repColor(-1, palette)).toBe(palette[0]);
  });
});

describe('findActiveRep', () => {
  const reps = [rep(1, 10, 30), rep(2, 50, 70), rep(3, 90, 110)];

  it('returns the rep whose window contains the frame', () => {
    expect(findActiveRep({ reps, currentFrame: 20 })?.repNumber).toBe(1);
    expect(findActiveRep({ reps, currentFrame: 60 })?.repNumber).toBe(2);
    expect(findActiveRep({ reps, currentFrame: 100 })?.repNumber).toBe(3);
  });

  it('treats startFrame and endFrame as inclusive', () => {
    expect(findActiveRep({ reps, currentFrame: 10 })?.repNumber).toBe(1);
    expect(findActiveRep({ reps, currentFrame: 30 })?.repNumber).toBe(1);
  });

  it('returns null when between reps', () => {
    expect(findActiveRep({ reps, currentFrame: 40 })).toBeNull();
    expect(findActiveRep({ reps, currentFrame: 80 })).toBeNull();
  });

  it('returns null when outside any rep', () => {
    expect(findActiveRep({ reps, currentFrame: 0 })).toBeNull();
    expect(findActiveRep({ reps, currentFrame: 200 })).toBeNull();
  });

  it('returns null when there are no reps', () => {
    expect(findActiveRep({ reps: [], currentFrame: 10 })).toBeNull();
  });
});

describe('pickHeadDot', () => {
  it('picks the closest stored point', () => {
    const path = [point(10), point(20), point(30)];
    expect(pickHeadDot({ barPath: path, currentFrame: 21 })?.frame).toBe(20);
    expect(pickHeadDot({ barPath: path, currentFrame: 26 })?.frame).toBe(30);
  });

  it('returns the only point when path has length 1', () => {
    const path = [point(15)];
    expect(pickHeadDot({ barPath: path, currentFrame: 100 })?.frame).toBe(15);
  });

  it('returns null on empty path', () => {
    expect(pickHeadDot({ barPath: [], currentFrame: 10 })).toBeNull();
  });
});
