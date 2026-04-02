import { describe, expect, it } from 'vitest';

import { computeAuxWeight, getWeightPct } from './exercise-catalog';

describe('clean variant weight ordering', () => {
  it('Power Clean >= Hang Clean > Clean and Jerk', () => {
    const powerClean = getWeightPct('Power Clean');
    const hangClean = getWeightPct('Barbell Hang Clean');
    const cleanAndJerk = getWeightPct('Clean and Jerk');

    expect(powerClean).toBeGreaterThanOrEqual(hangClean);
    expect(hangClean).toBeGreaterThan(cleanAndJerk);
  });

  it('computeAuxWeight reflects correct ordering for a 180kg deadlift 1RM', () => {
    const opts = { oneRmKg: 180, lift: 'deadlift' as const };
    const powerClean = computeAuxWeight({ exercise: 'Power Clean', ...opts });
    const hangClean = computeAuxWeight({
      exercise: 'Barbell Hang Clean',
      ...opts,
    });
    const cleanAndJerk = computeAuxWeight({
      exercise: 'Clean and Jerk',
      ...opts,
    });

    expect(powerClean).toBeGreaterThanOrEqual(hangClean);
    expect(hangClean).toBeGreaterThan(cleanAndJerk);

    // Sanity: all in a reasonable range (40-60% of DL 1RM)
    expect(powerClean).toBeCloseTo(180 * 0.55, 1);
    expect(hangClean).toBeCloseTo(180 * 0.5, 1);
    expect(cleanAndJerk).toBeCloseTo(180 * 0.45, 1);
  });
});
