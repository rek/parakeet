import { describe, expect, it } from 'vitest';

import type { LipedemaMeasurement } from '../../model/types';
import { adjacentDelta, limbTrend, priorValue, seriesDrift } from '../trends';

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
    painScore: null,
    swellingScore: null,
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

describe('seriesDrift', () => {
  it('returns last minus first', () => {
    expect(
      seriesDrift([
        { date: '2026-04-01', value: 620 },
        { date: '2026-04-08', value: 610 },
        { date: '2026-04-15', value: 595 },
      ]),
    ).toBe(-25);
  });

  it('null when fewer than 2 points', () => {
    expect(seriesDrift([])).toBeNull();
    expect(seriesDrift([{ date: '2026-04-01', value: 620 }])).toBeNull();
  });
});

describe('adjacentDelta', () => {
  it('returns last minus second-last', () => {
    expect(
      adjacentDelta([
        { date: '2026-04-01', value: 620 },
        { date: '2026-04-08', value: 610 },
        { date: '2026-04-15', value: 595 },
      ]),
    ).toBe(-15);
  });

  it('null when fewer than 2 points', () => {
    expect(adjacentDelta([])).toBeNull();
    expect(adjacentDelta([{ date: '2026-04-01', value: 620 }])).toBeNull();
  });
});

describe('priorValue', () => {
  it('returns most recent non-null prior measurement', () => {
    const rows = [
      row('2026-04-01', { thighMidLMm: 620 }),
      row('2026-04-08', { thighMidLMm: null }),
      row('2026-04-15', { thighMidLMm: 600 }),
    ];
    const p = priorValue(rows, (m) => m.thighMidLMm);
    expect(p).toEqual({ date: '2026-04-15', value: 600 });
  });

  it('skips excludeDate so "prior to today" really skips today', () => {
    const rows = [
      row('2026-04-01', { thighMidLMm: 620 }),
      row('2026-04-15', { thighMidLMm: 605 }),
    ];
    const p = priorValue(rows, (m) => m.thighMidLMm, '2026-04-15');
    expect(p).toEqual({ date: '2026-04-01', value: 620 });
  });

  it('skips nulls when scanning back', () => {
    const rows = [
      row('2026-04-01', { thighMidLMm: 620 }),
      row('2026-04-08', { thighMidLMm: null }),
      row('2026-04-15', { thighMidLMm: null }),
    ];
    const p = priorValue(rows, (m) => m.thighMidLMm, '2026-04-15');
    expect(p).toEqual({ date: '2026-04-01', value: 620 });
  });

  it('returns null when no prior non-null exists', () => {
    expect(priorValue([], (m) => m.thighMidLMm)).toBeNull();
    const rows = [row('2026-04-15', { thighMidLMm: null })];
    expect(priorValue(rows, (m) => m.thighMidLMm)).toBeNull();
  });
});
