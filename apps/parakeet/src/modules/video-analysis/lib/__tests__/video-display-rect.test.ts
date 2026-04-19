import { describe, expect, it } from 'vitest';

import { computeDisplayRect } from '../video-display-rect';

describe('computeDisplayRect', () => {
  it('letterboxes (top/bottom bars) when video is wider than container', () => {
    // Container 400×400 (1:1), video 1920×1080 (16:9 — wider)
    const rect = computeDisplayRect({
      containerWidth: 400,
      containerHeight: 400,
      videoWidthPx: 1920,
      videoHeightPx: 1080,
    });
    expect(rect.width).toBe(400);
    expect(rect.height).toBeCloseTo(225, 5); // 400 / (16/9) = 225
    expect(rect.offsetX).toBe(0);
    expect(rect.offsetY).toBeCloseTo(87.5, 5); // (400 - 225) / 2
  });

  it('pillarboxes (side bars) when video is taller than container', () => {
    // Container 400×400 (1:1), video 1080×1920 (9:16 — taller)
    const rect = computeDisplayRect({
      containerWidth: 400,
      containerHeight: 400,
      videoWidthPx: 1080,
      videoHeightPx: 1920,
    });
    expect(rect.height).toBe(400);
    expect(rect.width).toBeCloseTo(225, 5); // 400 * (9/16) = 225
    expect(rect.offsetY).toBe(0);
    expect(rect.offsetX).toBeCloseTo(87.5, 5);
  });

  it('returns container rect with no offsets when aspect ratios match', () => {
    const rect = computeDisplayRect({
      containerWidth: 320,
      containerHeight: 180,
      videoWidthPx: 1920,
      videoHeightPx: 1080,
    });
    expect(rect.width).toBe(320);
    expect(rect.height).toBeCloseTo(180, 5);
    expect(rect.offsetX).toBe(0);
    expect(rect.offsetY).toBeCloseTo(0, 5);
  });

  it('falls back to container rect when video dimensions are null', () => {
    const rect = computeDisplayRect({
      containerWidth: 400,
      containerHeight: 300,
      videoWidthPx: null,
      videoHeightPx: null,
    });
    expect(rect).toEqual({
      width: 400,
      height: 300,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it('falls back to container rect when container dimensions are zero', () => {
    const rect = computeDisplayRect({
      containerWidth: 0,
      containerHeight: 0,
      videoWidthPx: 1920,
      videoHeightPx: 1080,
    });
    expect(rect).toEqual({ width: 0, height: 0, offsetX: 0, offsetY: 0 });
  });

  it('falls back when video dimensions are zero or negative', () => {
    const rect = computeDisplayRect({
      containerWidth: 400,
      containerHeight: 300,
      videoWidthPx: 0,
      videoHeightPx: 1080,
    });
    expect(rect.offsetX).toBe(0);
    expect(rect.offsetY).toBe(0);
    expect(rect.width).toBe(400);
    expect(rect.height).toBe(300);
  });
});
