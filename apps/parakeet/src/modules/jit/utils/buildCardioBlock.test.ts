import { DEFAULT_CARDIO_POOL } from '@parakeet/training-engine';
import { describe, expect, it } from 'vitest';

import {
  buildCardioBlock,
  DEFAULT_CARDIO_DURATION_MIN,
} from './buildCardioBlock';

const POOL = ['Row Machine', 'Ski Erg', 'Assault Bike'];

describe('buildCardioBlock', () => {
  it('builds a timed single-set aux entry from the pool', () => {
    const block = buildCardioBlock({ cardioPool: POOL, durationMin: 15 });
    expect(block).toEqual({
      exercise: 'Row Machine',
      exerciseType: 'timed',
      sets: [{ set_number: 1, weight_kg: 0, reps: 15 }],
      skipped: false,
    });
  });

  it('rotates to a modality not done recently', () => {
    const block = buildCardioBlock({
      cardioPool: POOL,
      recentAuxExercises: ['Row Machine'],
    });
    expect(block?.exercise).toBe('Ski Erg');
  });

  it('falls back to the first modality when all were done recently', () => {
    const block = buildCardioBlock({
      cardioPool: POOL,
      recentAuxExercises: POOL,
    });
    expect(block?.exercise).toBe('Row Machine');
  });

  it('falls back to the engine default pool when none configured', () => {
    const block = buildCardioBlock({});
    expect(block).not.toBeNull();
    expect(DEFAULT_CARDIO_POOL).toContain(block?.exercise);
  });

  it('falls back to the default pool when the configured pool is empty', () => {
    const block = buildCardioBlock({ cardioPool: [] });
    expect(block).not.toBeNull();
    expect(DEFAULT_CARDIO_POOL).toContain(block?.exercise);
  });

  it('defaults the duration when none is given', () => {
    const block = buildCardioBlock({ cardioPool: POOL });
    expect(block?.sets[0].reps).toBe(DEFAULT_CARDIO_DURATION_MIN);
  });

  it('clamps absurd durations into range', () => {
    expect(buildCardioBlock({ cardioPool: POOL, durationMin: 999 })?.sets[0].reps).toBe(
      90
    );
    expect(buildCardioBlock({ cardioPool: POOL, durationMin: 0 })?.sets[0].reps).toBe(
      1
    );
  });
});
