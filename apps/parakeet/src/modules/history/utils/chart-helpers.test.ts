import type { Lift } from '@parakeet/shared-types';
import { describe, expect, it } from 'vitest';

import {
  buildWeeklyHeaviestChartData,
  type WeeklyHeaviestRow,
} from './chart-helpers';

const LIFT_COLORS: Record<Lift, string> = {
  squat: '#a3e635',
  bench: '#f97316',
  deadlift: '#2dd4bf',
};

describe('buildWeeklyHeaviestChartData', () => {
  it('returns null when no data', () => {
    expect(buildWeeklyHeaviestChartData([], LIFT_COLORS)).toBeNull();
  });

  it('builds one dataset per lift when no filter', () => {
    const rows: WeeklyHeaviestRow[] = [
      { weekStart: '2026-04-06', lift: 'squat', heaviestKg: 140 },
      { weekStart: '2026-04-06', lift: 'bench', heaviestKg: 100 },
      { weekStart: '2026-04-13', lift: 'squat', heaviestKg: 142.5 },
    ];
    const result = buildWeeklyHeaviestChartData(rows, LIFT_COLORS);
    expect(result!.lifts).toEqual(['squat', 'bench', 'deadlift']);
    expect(result!.datasets).toHaveLength(3);
  });

  it('fills missing weeks with 0 and rounds values', () => {
    const rows: WeeklyHeaviestRow[] = [
      { weekStart: '2026-04-06', lift: 'squat', heaviestKg: 140.4 },
      { weekStart: '2026-04-13', lift: 'squat', heaviestKg: 142.6 },
    ];
    const result = buildWeeklyHeaviestChartData(rows, LIFT_COLORS, 'squat');
    expect(result!.datasets[0].data).toEqual([140, 143]);
    // bench has no entries — when filtered to squat, only squat dataset
    expect(result!.datasets).toHaveLength(1);
  });

  it('returns 0 for weeks missing a lift', () => {
    const rows: WeeklyHeaviestRow[] = [
      { weekStart: '2026-04-06', lift: 'squat', heaviestKg: 140 },
      { weekStart: '2026-04-13', lift: 'bench', heaviestKg: 100 },
    ];
    const result = buildWeeklyHeaviestChartData(rows, LIFT_COLORS);
    const squat = result!.datasets[0];
    const bench = result!.datasets[1];
    // weeks sorted: [2026-04-06, 2026-04-13]
    expect(squat.data).toEqual([140, 0]);
    expect(bench.data).toEqual([0, 100]);
  });

  it('pads a single week with a prior week so chart-kit can render line', () => {
    const rows: WeeklyHeaviestRow[] = [
      { weekStart: '2026-04-06', lift: 'squat', heaviestKg: 140 },
    ];
    const result = buildWeeklyHeaviestChartData(rows, LIFT_COLORS, 'squat');
    expect(result!.labels).toHaveLength(2);
    expect(result!.datasets[0].data).toEqual([0, 140]);
  });
});
