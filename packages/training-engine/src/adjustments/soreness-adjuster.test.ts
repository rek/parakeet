import { makeSets } from '../__test-helpers__/fixtures';
import {
  applySorenessToSets,
  getPrimaryMusclesForSession,
  getSorenessModifier,
  getWorstSoreness,
} from './soreness-adjuster';

describe('getSorenessModifier — female sex', () => {
  it('level 8 female → reduce 1 set, 3% intensity drop', () => {
    const m = getSorenessModifier(8, 'female');
    expect(m.setReduction).toBe(1);
    expect(m.intensityMultiplier).toBe(0.97);
    expect(m.recoveryMode).toBe(false);
  });

  it('level 9 female → recovery mode (unchanged from male)', () => {
    expect(getSorenessModifier(9, 'female').recoveryMode).toBe(true);
  });

  it('level 6 female → reduce 1 set (unchanged from male)', () => {
    const m = getSorenessModifier(6, 'female');
    expect(m.setReduction).toBe(1);
    expect(m.intensityMultiplier).toBe(1.0);
  });

  it('no sex arg → male table', () => {
    expect(getSorenessModifier(8).setReduction).toBe(2);
    expect(getSorenessModifier(8).intensityMultiplier).toBe(0.95);
  });

  it('explicit male → male table', () => {
    expect(getSorenessModifier(8, 'male').setReduction).toBe(2);
    expect(getSorenessModifier(8, 'male').intensityMultiplier).toBe(0.95);
  });
});

describe('getSorenessModifier', () => {
  it('level 1 → no adjustment (fresh)', () => {
    const m = getSorenessModifier(1);
    expect(m.setReduction).toBe(0);
    expect(m.intensityMultiplier).toBe(1.0);
    expect(m.recoveryMode).toBe(false);
    expect(m.warning).toBeNull();
  });

  it('level 4 → no adjustment (fresh)', () => {
    const m = getSorenessModifier(4);
    expect(m.setReduction).toBe(0);
    expect(m.recoveryMode).toBe(false);
  });

  it('level 5 → moderate, reduce 1 set', () => {
    const m = getSorenessModifier(5);
    expect(m.setReduction).toBe(1);
    expect(m.intensityMultiplier).toBe(1.0);
    expect(m.warning).toMatch(/moderate/i);
  });

  it('level 6 → moderate, reduce 1 set', () => {
    const m = getSorenessModifier(6);
    expect(m.setReduction).toBe(1);
    expect(m.intensityMultiplier).toBe(1.0);
  });

  it('level 7 → high, reduce 2 sets, 5% intensity drop', () => {
    const m = getSorenessModifier(7);
    expect(m.setReduction).toBe(2);
    expect(m.intensityMultiplier).toBe(0.95);
  });

  it('level 8 → high, reduce 2 sets, 5% intensity drop', () => {
    const m = getSorenessModifier(8);
    expect(m.setReduction).toBe(2);
    expect(m.intensityMultiplier).toBe(0.95);
  });

  it('level 9 → recovery mode', () => {
    const m = getSorenessModifier(9);
    expect(m.recoveryMode).toBe(true);
    expect(m.warning).toMatch(/severe/i);
  });

  it('level 10 → recovery mode', () => {
    const m = getSorenessModifier(10);
    expect(m.recoveryMode).toBe(true);
    expect(m.warning).toMatch(/severe/i);
  });

  it('scale is monotonic — higher levels never produce less adjustment (below recovery)', () => {
    // Recovery mode (9-10) uses a different mechanism (3×5 at 40%), so
    // monotonicity is checked only for non-recovery tiers (1-8).
    for (let i = 1; i < 8; i++) {
      const lower = getSorenessModifier(i as any);
      const higher = getSorenessModifier((i + 1) as any);
      expect(higher.setReduction).toBeGreaterThanOrEqual(lower.setReduction);
      expect(higher.intensityMultiplier).toBeLessThanOrEqual(
        lower.intensityMultiplier
      );
    }
  });
});

describe('applySorenessToSets', () => {
  it('soreness 1 → sets unchanged', () => {
    const sets = makeSets(3, 100);
    const result = applySorenessToSets(sets, getSorenessModifier(1));
    expect(result).toHaveLength(3);
    expect(result[0].weight_kg).toBe(100);
  });

  it('soreness 5 (moderate) → planned 2 sets returns 1 set', () => {
    const sets = makeSets(2, 100);
    const result = applySorenessToSets(sets, getSorenessModifier(5));
    expect(result).toHaveLength(1);
  });

  it('soreness 8 (high) → 2 sets at 112.5kg → 1 set (clamped) at 107.5kg', () => {
    const sets = makeSets(2, 112.5);
    const result = applySorenessToSets(sets, getSorenessModifier(8));
    // 2 - 2 = 0, clamped to minSets=1
    expect(result).toHaveLength(1);
    // 112.5 × 0.95 = 106.875 → roundToNearest(106.875, 2.5) = 107.5
    expect(result[0].weight_kg).toBe(107.5);
  });

  it('soreness 9 (severe) → recovery mode: 3 sets × 5 reps at 40% of original weight', () => {
    const sets = makeSets(4, 112.5);
    const result = applySorenessToSets(sets, getSorenessModifier(9));
    expect(result).toHaveLength(3);
    // 112.5 × 0.40 = 45.0
    result.forEach((s) => {
      expect(s.weight_kg).toBe(45);
      expect(s.reps).toBe(5);
      expect(s.rpe_target).toBe(5.0);
    });
  });

  it('recovery mode with very light weight floors to 20kg bar', () => {
    const sets = makeSets(3, 30);
    const result = applySorenessToSets(sets, getSorenessModifier(10));
    // 30 × 0.40 = 12 → roundToNearest = 12.5 → max(20, 12.5) = 20
    expect(result[0].weight_kg).toBe(20);
  });

  it('respects custom minSets parameter', () => {
    const sets = makeSets(3, 100);
    const result = applySorenessToSets(sets, getSorenessModifier(8), 2);
    // 3 - 2 = 1, but minSets=2 → 2 sets
    expect(result).toHaveLength(2);
  });
});

describe('getPrimaryMusclesForSession', () => {
  it('squat → quads, glutes, lower_back', () => {
    expect(getPrimaryMusclesForSession('squat')).toEqual([
      'quads',
      'glutes',
      'lower_back',
    ]);
  });

  it('bench → chest, triceps, shoulders', () => {
    expect(getPrimaryMusclesForSession('bench')).toEqual([
      'chest',
      'triceps',
      'shoulders',
    ]);
  });

  it('deadlift → hamstrings, glutes, lower_back, upper_back', () => {
    expect(getPrimaryMusclesForSession('deadlift')).toEqual([
      'hamstrings',
      'glutes',
      'lower_back',
      'upper_back',
    ]);
  });
});

describe('getWorstSoreness', () => {
  it('returns the max soreness across given muscles', () => {
    expect(
      getWorstSoreness(['quads', 'glutes', 'lower_back'], {
        quads: 2,
        glutes: 7,
        lower_back: 1,
      })
    ).toBe(7);
  });

  it('defaults to 1 for muscles missing from ratings', () => {
    expect(getWorstSoreness(['quads', 'glutes'], { quads: 3 })).toBe(3);
  });

  it('returns 1 when all muscles are fresh', () => {
    expect(
      getWorstSoreness(['chest', 'triceps'], { chest: 1, triceps: 1 })
    ).toBe(1);
  });
});
