import { describe, expect, it } from 'vitest';

import { computeMinimalDayShift } from './computeMinimalDayShift';

describe('computeMinimalDayShift', () => {
  it('returns 0 when days are the same', () => {
    expect(computeMinimalDayShift({ oldFirst: 2, newFirst: 2 })).toBe(0);
  });

  it('shifts forward for small positive deltas', () => {
    // Mon→Tue = +1
    expect(computeMinimalDayShift({ oldFirst: 1, newFirst: 2 })).toBe(1);
    // Mon→Thu = +3
    expect(computeMinimalDayShift({ oldFirst: 1, newFirst: 4 })).toBe(3);
  });

  it('shifts backward for small negative deltas', () => {
    // Tue→Mon = -1
    expect(computeMinimalDayShift({ oldFirst: 2, newFirst: 1 })).toBe(-1);
    // Thu→Mon = -3
    expect(computeMinimalDayShift({ oldFirst: 4, newFirst: 1 })).toBe(-3);
  });

  it('wraps forward when backward would be farther', () => {
    // Fri→Mon: raw -4, wraps to +3
    expect(computeMinimalDayShift({ oldFirst: 5, newFirst: 1 })).toBe(3);
    // Sat→Mon: raw -5, wraps to +2
    expect(computeMinimalDayShift({ oldFirst: 6, newFirst: 1 })).toBe(2);
  });

  it('wraps backward when forward would be farther', () => {
    // Mon→Fri: raw +4, wraps to -3
    expect(computeMinimalDayShift({ oldFirst: 1, newFirst: 5 })).toBe(-3);
    // Mon→Sat: raw +5, wraps to -2
    expect(computeMinimalDayShift({ oldFirst: 1, newFirst: 6 })).toBe(-2);
  });

  it('never exceeds magnitude 3', () => {
    for (let old = 0; old <= 6; old++) {
      for (let neu = 0; neu <= 6; neu++) {
        const shift = computeMinimalDayShift({ oldFirst: old, newFirst: neu });
        expect(Math.abs(shift)).toBeLessThanOrEqual(3);
      }
    }
  });

  it('is antisymmetric: swap(a,b) = -swap(b,a)', () => {
    for (let a = 0; a <= 6; a++) {
      for (let b = 0; b <= 6; b++) {
        const ab = computeMinimalDayShift({ oldFirst: a, newFirst: b });
        const ba = computeMinimalDayShift({ oldFirst: b, newFirst: a });
        expect(ab).toBe(-ba || 0);
      }
    }
  });
});
