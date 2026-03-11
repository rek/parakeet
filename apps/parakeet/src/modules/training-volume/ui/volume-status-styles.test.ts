import { describe, expect, it } from 'vitest';

import {
  getVolumeStatusColor,
  isVolumeOverMrv,
  volumeBarColor,
  volumeFillPct,
} from './volume-status-styles';

const colors = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

describe('getVolumeStatusColor', () => {
  it('returns info for below_mev', () => {
    expect(getVolumeStatusColor('below_mev', colors)).toBe('info');
  });

  it('returns success for in_range', () => {
    expect(getVolumeStatusColor('in_range', colors)).toBe('success');
  });

  it('returns warning for approaching_mrv', () => {
    expect(getVolumeStatusColor('approaching_mrv', colors)).toBe('warning');
  });

  it('returns danger for at_mrv', () => {
    expect(getVolumeStatusColor('at_mrv', colors)).toBe('danger');
  });

  it('returns danger for exceeded_mrv', () => {
    expect(getVolumeStatusColor('exceeded_mrv', colors)).toBe('danger');
  });

  it('returns info for unknown status (default branch)', () => {
    // Cast to bypass type check for testing the default branch
    expect(getVolumeStatusColor('unknown' as never, colors)).toBe('info');
  });
});

describe('isVolumeOverMrv', () => {
  it('returns true for at_mrv', () => {
    expect(isVolumeOverMrv('at_mrv')).toBe(true);
  });

  it('returns true for exceeded_mrv', () => {
    expect(isVolumeOverMrv('exceeded_mrv')).toBe(true);
  });

  it('returns false for below_mev', () => {
    expect(isVolumeOverMrv('below_mev')).toBe(false);
  });

  it('returns false for in_range', () => {
    expect(isVolumeOverMrv('in_range')).toBe(false);
  });

  it('returns false for approaching_mrv', () => {
    expect(isVolumeOverMrv('approaching_mrv')).toBe(false);
  });
});

describe('volumeFillPct', () => {
  it('returns correct percentage for normal case', () => {
    expect(volumeFillPct(10, 20)).toBe(50);
  });

  it('returns 0 when mrv is 0', () => {
    expect(volumeFillPct(10, 0)).toBe(0);
  });

  it('clamps to 100 when sets exceed mrv', () => {
    expect(volumeFillPct(25, 20)).toBe(100);
  });

  it('returns exactly 100 when sets equal mrv', () => {
    expect(volumeFillPct(20, 20)).toBe(100);
  });

  it('returns fractional percentage correctly', () => {
    expect(volumeFillPct(1, 4)).toBe(25);
  });
});

describe('volumeBarColor', () => {
  it('returns danger at 1.0 (exactly at threshold)', () => {
    expect(volumeBarColor(1.0, colors)).toBe('danger');
  });

  it('returns danger above 1.0', () => {
    expect(volumeBarColor(1.5, colors)).toBe('danger');
  });

  it('returns warning at 0.85 (exactly at threshold)', () => {
    expect(volumeBarColor(0.85, colors)).toBe('warning');
  });

  it('returns warning between 0.85 and 1.0', () => {
    expect(volumeBarColor(0.9, colors)).toBe('warning');
  });

  it('returns success at 0.5 (exactly at threshold)', () => {
    expect(volumeBarColor(0.5, colors)).toBe('success');
  });

  it('returns success between 0.5 and 0.85', () => {
    expect(volumeBarColor(0.7, colors)).toBe('success');
  });

  it('returns info below 0.5', () => {
    expect(volumeBarColor(0.49, colors)).toBe('info');
  });

  it('returns info at 0', () => {
    expect(volumeBarColor(0, colors)).toBe('info');
  });
});
