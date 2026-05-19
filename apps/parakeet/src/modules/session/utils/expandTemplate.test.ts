import { describe, expect, it } from 'vitest';

import type { WorkoutTemplateItem } from '@modules/workout-templates';

import { expandTemplate } from './expandTemplate';

const baseItem = (
  position: number,
  exercise: string,
  duration: number | null,
  reps: number | null,
  rest: number
): WorkoutTemplateItem => ({
  id: `i-${position}`,
  template_id: 't-1',
  position,
  exercise,
  duration_seconds: duration,
  reps,
  rest_after_seconds: rest,
});

describe('expandTemplate', () => {
  it('expands 3 items × 5 rounds into 15 entries in round-by-round order', () => {
    const items = [
      baseItem(0, 'Assault Bike', 60, null, 20),
      baseItem(1, 'Ski Erg', 60, null, 20),
      baseItem(2, 'Row Machine', 60, null, 60),
    ];

    const entries = expandTemplate({ rounds: 5, name: 'test-template' }, items);

    expect(entries).toHaveLength(15);
    expect(entries.map((e) => e.exercise)).toEqual([
      'Assault Bike',
      'Ski Erg',
      'Row Machine',
      'Assault Bike',
      'Ski Erg',
      'Row Machine',
      'Assault Bike',
      'Ski Erg',
      'Row Machine',
      'Assault Bike',
      'Ski Erg',
      'Row Machine',
      'Assault Bike',
      'Ski Erg',
      'Row Machine',
    ]);
  });

  it('shares a single template_instance_id across all entries', () => {
    const items = [
      baseItem(0, 'Assault Bike', 60, null, 20),
      baseItem(1, 'Ski Erg', 60, null, 20),
    ];

    const entries = expandTemplate({ rounds: 3, name: 'test-template' }, items);
    const ids = new Set(entries.map((e) => e.template_instance_id));

    expect(ids.size).toBe(1);
    expect([...ids][0]).toMatch(/^[a-z0-9-]+$/i);
  });

  it('threads rest_after_seconds onto each entry as prescribed_rest_seconds', () => {
    const items = [
      baseItem(0, 'Assault Bike', 60, null, 20),
      baseItem(1, 'Row Machine', 60, null, 90),
    ];

    const entries = expandTemplate({ rounds: 2, name: 'test-template' }, items);

    expect(entries.map((e) => e.prescribed_rest_seconds)).toEqual([
      20, 90, 20, 90,
    ]);
  });

  it('sets reps_completed to 0 for timed entries and to item.reps otherwise', () => {
    const items = [
      baseItem(0, 'Assault Bike', 60, null, 20), // timed in catalog
      baseItem(1, 'Dumbbell Curl', null, 12, 60), // weighted in catalog
    ];

    const entries = expandTemplate({ rounds: 1, name: 'test-template' }, items);

    expect(entries[0].reps_completed).toBe(0);
    expect(entries[0].exercise_type).toBe('timed');
    expect(entries[1].reps_completed).toBe(12);
    expect(entries[1].exercise_type).toBe('weighted');
  });

  it('seeds weight_grams from computeWeightGrams for weighted items only', () => {
    const items = [
      baseItem(0, 'Assault Bike', 60, null, 20), // timed — should stay 0
      baseItem(1, 'Dumbbell Curl', null, 12, 60), // weighted — should resolve
    ];

    const entries = expandTemplate({ rounds: 1, name: 'test-template' }, items, {
      computeWeightGrams: (ex) => (ex === 'Dumbbell Curl' ? 5000 : 99999),
    });

    expect(entries[0].weight_grams).toBe(0); // timed never calls the resolver
    expect(entries[1].weight_grams).toBe(5000);
  });

  it('throws when an exercise appears more than once in the items list', () => {
    const items = [
      baseItem(0, 'Assault Bike', 60, null, 20),
      baseItem(1, 'Assault Bike', 60, null, 30),
    ];

    expect(() =>
      expandTemplate({ rounds: 3, name: 'bad-template' }, items)
    ).toThrow(/duplicate exercise "Assault Bike"/);
  });

  it('respects input position order even when items arrive out of order', () => {
    const items = [
      baseItem(2, 'Row Machine', 60, null, 60),
      baseItem(0, 'Assault Bike', 60, null, 20),
      baseItem(1, 'Ski Erg', 60, null, 20),
    ];

    const entries = expandTemplate({ rounds: 1, name: 'test-template' }, items);

    expect(entries.map((e) => e.exercise)).toEqual([
      'Assault Bike',
      'Ski Erg',
      'Row Machine',
    ]);
  });
});
