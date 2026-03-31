import { describe, expect, it } from 'vitest';

import { computeRepTempo } from '../rep-tempo';

describe('computeRepTempo', () => {
  it('computes tempo for a symmetric rep', () => {
    // 8 frames: 4 eccentric + 4 concentric (bottom at frame 4)
    const repPath = [
      { x: 0.5, y: 0.3, frame: 0 },
      { x: 0.5, y: 0.375, frame: 1 },
      { x: 0.5, y: 0.45, frame: 2 },
      { x: 0.5, y: 0.525, frame: 3 },
      { x: 0.5, y: 0.6, frame: 4 }, // bottom
      { x: 0.5, y: 0.525, frame: 5 },
      { x: 0.5, y: 0.45, frame: 6 },
      { x: 0.5, y: 0.375, frame: 7 },
      { x: 0.5, y: 0.3, frame: 8 },
    ];

    const tempo = computeRepTempo({ repPath, fps: 4 });
    expect(tempo).not.toBeNull();
    // Eccentric: 4 frames = 1.0s, Concentric: 4 frames = 1.0s
    expect(tempo!.eccentricDurationSec).toBe(1.0);
    expect(tempo!.concentricDurationSec).toBe(1.0);
    expect(tempo!.tempoRatio).toBe(1.0);
  });

  it('computes tempo for a slow eccentric / fast concentric', () => {
    // Bottom at frame 6 of 9: 6 ecc + 3 con
    const repPath = [
      { x: 0.5, y: 0.3, frame: 0 },
      { x: 0.5, y: 0.35, frame: 1 },
      { x: 0.5, y: 0.4, frame: 2 },
      { x: 0.5, y: 0.45, frame: 3 },
      { x: 0.5, y: 0.5, frame: 4 },
      { x: 0.5, y: 0.55, frame: 5 },
      { x: 0.5, y: 0.6, frame: 6 }, // bottom
      { x: 0.5, y: 0.45, frame: 7 },
      { x: 0.5, y: 0.3, frame: 8 },
    ];

    const tempo = computeRepTempo({ repPath, fps: 4 });
    expect(tempo).not.toBeNull();
    // Ecc: 6 frames = 1.5s, Con: 2 frames = 0.5s
    expect(tempo!.eccentricDurationSec).toBe(1.5);
    expect(tempo!.concentricDurationSec).toBe(0.5);
    expect(tempo!.tempoRatio).toBe(3.0);
  });

  it('returns null for too few frames', () => {
    const repPath = [
      { x: 0.5, y: 0.3, frame: 0 },
      { x: 0.5, y: 0.6, frame: 1 },
    ];
    expect(computeRepTempo({ repPath, fps: 4 })).toBeNull();
  });

  it('returns null when bottom is at the start (no eccentric)', () => {
    const repPath = [
      { x: 0.5, y: 0.6, frame: 0 }, // bottom at start
      { x: 0.5, y: 0.5, frame: 1 },
      { x: 0.5, y: 0.4, frame: 2 },
      { x: 0.5, y: 0.3, frame: 3 },
    ];
    expect(computeRepTempo({ repPath, fps: 4 })).toBeNull();
  });
});
