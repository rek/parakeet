import { describe, expect, it } from 'vitest';

import type { LipedemaMeasurement } from '../../model/types';
import { latestDelta, limbTrend } from '../trends';

function row(
  date: string,
  partial: Partial<LipedemaMeasurement> = {},
): LipedemaMeasurement {
  return {
    id: date,
    userId: 'u',
    recordedDate: date,
    thighMidLMm: null,
    thighMidRMm: null,
    calfMaxLMm: null,
    calfMaxRMm: null,
    ankleLMm: null,
    ankleRMm: null,
    upperArmLMm: null,
    upperArmRMm: null,
    wristLMm: null,
    wristRMm: null,
    pain_0_10: null,
    swelling_0_10: null,
    notes: null,
    photoUrl: null,
    createdAt: date + 'T00:00:00Z',
    updatedAt: date + 'T00:00:00Z',
    ...partial,
  };
}

describe('limbTrend', () => {
  it('extracts L/R series sorted ascending by date', () => {
    const rows = [
      row('2026-04-08', { thighMidLMm: 600, thighMidRMm: 605 }),
      row('2026-04-01', { thighMidLMm: 620, thighMidRMm: 625 }),
      row('2026-04-15', { thighMidLMm: 595, thighMidRMm: 600 }),
    ];
    const t = limbTrend(rows, (m) => ({ l: m.thighMidLMm, r: m.thighMidRMm }));
    expect(t.sideL.map((p) => p.date)).toEqual([
      '2026-04-01',
      '2026-04-08',
      '2026-04-15',
    ]);
    expect(t.sideL.map((p) => p.value)).toEqual([620, 600, 595]);
    expect(t.sideR.map((p) => p.value)).toEqual([625, 605, 600]);
  });

  it('skips missing values (no imputation)', () => {
    const rows = [
      row('2026-04-01', { thighMidLMm: 620, thighMidRMm: null }),
      row('2026-04-08', { thighMidLMm: null, thighMidRMm: 605 }),
    ];
    const t = limbTrend(rows, (m) => ({ l: m.thighMidLMm, r: m.thighMidRMm }));
    expect(t.sideL).toHaveLength(1);
    expect(t.sideR).toHaveLength(1);
  });

  it('returns empty on no rows', () => {
    const t = limbTrend([], (m) => ({ l: m.thighMidLMm, r: m.thighMidRMm }));
    expect(t.sideL).toEqual([]);
    expect(t.sideR).toEqual([]);
  });
});

describe('latestDelta', () => {
  it('returns last minus first', () => {
    expect(
      latestDelta([
        { date: '2026-04-01', value: 620 },
        { date: '2026-04-15', value: 595 },
      ]),
    ).toBe(-25);
  });

  it('null when fewer than 2 points', () => {
    expect(latestDelta([])).toBeNull();
    expect(latestDelta([{ date: '2026-04-01', value: 620 }])).toBeNull();
  });
});
