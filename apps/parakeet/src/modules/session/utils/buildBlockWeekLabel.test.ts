import { describe, expect, it } from 'vitest';
import { buildBlockWeekLabel } from './buildBlockWeekLabel';
import { buildIntensityLabel } from './buildIntensityLabel';

describe('buildBlockWeekLabel', () => {
  it('returns empty string for null meta', () => {
    expect(buildBlockWeekLabel(null)).toBe('');
  });

  it('returns empty string when primary_lift is null (free-form session)', () => {
    expect(buildBlockWeekLabel({ primary_lift: null, block_number: 1, week_number: 2 })).toBe('');
  });

  it('includes block number when present', () => {
    expect(buildBlockWeekLabel({ primary_lift: 'squat', block_number: 2, week_number: 3 })).toBe('Block 2 · Week 3');
  });

  it('omits block number for unending sessions', () => {
    expect(buildBlockWeekLabel({ primary_lift: 'squat', block_number: null, week_number: 5 })).toBe('Week 5');
  });
});

describe('buildIntensityLabel', () => {
  it('returns empty string for null meta', () => {
    expect(buildIntensityLabel(null)).toBe('');
  });

  it('returns empty string when intensity_type is null', () => {
    expect(buildIntensityLabel({ intensity_type: null, block_number: 1 })).toBe('');
  });

  it('includes block number when present', () => {
    expect(buildIntensityLabel({ intensity_type: 'heavy', block_number: 3 })).toBe('Block 3 · Heavy');
  });

  it('omits block number for unending sessions', () => {
    expect(buildIntensityLabel({ intensity_type: 'light', block_number: null })).toBe('Light');
  });
});
