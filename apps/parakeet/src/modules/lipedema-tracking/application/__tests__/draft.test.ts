import { describe, expect, it } from 'vitest';

import type { LipedemaMeasurement } from '../../model/types';
import {
  draftIsEmpty,
  draftToUpsert,
  emptyDraft,
  measurementToDraft,
} from '../draft';

const FULL: LipedemaMeasurement = {
  id: '1',
  userId: 'u',
  recordedDate: '2026-04-21',
  thighMidLMm: 620,
  thighMidRMm: 625,
  calfMaxLMm: 410,
  calfMaxRMm: 415,
  ankleLMm: 255,
  ankleRMm: 258,
  upperArmLMm: 330,
  upperArmRMm: 335,
  wristLMm: 160,
  wristRMm: 162,
  painScore: 3.5,
  swellingScore: 2,
  notes: 'heavier after travel',
  photoUrl: null,
  createdAt: '2026-04-21T00:00:00Z',
  updatedAt: '2026-04-21T00:00:00Z',
};

describe('emptyDraft', () => {
  it('initialises everything to empty strings with the given date', () => {
    const d = emptyDraft('2026-04-21');
    expect(d.recordedDate).toBe('2026-04-21');
    expect(d.thighMidL).toBe('');
    expect(d.notes).toBe('');
  });
});

describe('measurementToDraft', () => {
  it('renders mm as cm strings with 1 decimal', () => {
    const d = measurementToDraft(FULL);
    expect(d.thighMidL).toBe('62.0');
    expect(d.calfMaxL).toBe('41.0');
    expect(d.pain).toBe('3.5');
    expect(d.notes).toBe('heavier after travel');
  });
});

describe('draftToUpsert', () => {
  it('round-trips through measurementToDraft cleanly', () => {
    const d = measurementToDraft(FULL);
    const u = draftToUpsert(d);
    expect(u.thigh_mid_l_mm).toBe(620);
    expect(u.thigh_mid_r_mm).toBe(625);
    expect(u.pain_0_10).toBe(3.5);
    expect(u.swelling_0_10).toBe(2);
    expect(u.notes).toBe('heavier after travel');
  });

  it('maps blank strings to null', () => {
    const d = emptyDraft('2026-04-21');
    const u = draftToUpsert(d);
    expect(u.thigh_mid_l_mm).toBeNull();
    expect(u.pain_0_10).toBeNull();
    expect(u.notes).toBeNull();
  });
});

describe('draftIsEmpty', () => {
  it('true when draft is blank', () => {
    expect(draftIsEmpty(emptyDraft('2026-04-21'))).toBe(true);
  });

  it('false when any field has a value', () => {
    const d = { ...emptyDraft('2026-04-21'), pain: '3' };
    expect(draftIsEmpty(d)).toBe(false);
  });

  it('false when notes-only', () => {
    const d = { ...emptyDraft('2026-04-21'), notes: 'feeling ok' };
    expect(draftIsEmpty(d)).toBe(false);
  });
});
