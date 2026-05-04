import { describe, expect, it } from 'vitest';

import {
  cmStringToMm,
  mmToCmString,
  parseInProgressCmToMm,
  parseZeroToTen,
} from '../units';

describe('cmStringToMm', () => {
  it('rounds cm with 1 decimal to integer mm', () => {
    expect(cmStringToMm('55.5')).toBe(555);
    expect(cmStringToMm('100')).toBe(1000);
    expect(cmStringToMm('0.3')).toBe(3);
  });

  it('trims whitespace', () => {
    expect(cmStringToMm('  62.0  ')).toBe(620);
  });

  it('returns null on empty / whitespace / invalid', () => {
    expect(cmStringToMm('')).toBeNull();
    expect(cmStringToMm('   ')).toBeNull();
    expect(cmStringToMm('abc')).toBeNull();
  });

  it('rejects negative values', () => {
    expect(cmStringToMm('-5')).toBeNull();
  });

  it('half-mm values round to nearest', () => {
    expect(cmStringToMm('55.55')).toBe(556);
    expect(cmStringToMm('55.54')).toBe(555);
  });
});

describe('mmToCmString', () => {
  it('renders mm as cm with 1 decimal', () => {
    expect(mmToCmString(555)).toBe('55.5');
    expect(mmToCmString(1000)).toBe('100.0');
    expect(mmToCmString(3)).toBe('0.3');
  });

  it('returns empty for null / undefined', () => {
    expect(mmToCmString(null)).toBe('');
    expect(mmToCmString(undefined)).toBe('');
  });

  it('round-trips through cmStringToMm', () => {
    for (const v of ['0.0', '0.3', '55.5', '100.0', '325.7']) {
      expect(mmToCmString(cmStringToMm(v))).toBe(v);
    }
  });
});

describe('parseInProgressCmToMm', () => {
  it('returns mm for realistic limb measurements', () => {
    expect(parseInProgressCmToMm('62.0')).toBe(620);
    expect(parseInProgressCmToMm('1.0')).toBe(10);
    expect(parseInProgressCmToMm('325.7')).toBe(3257);
  });

  it('returns null for in-progress sub-1cm input (the typing-zero trap)', () => {
    expect(parseInProgressCmToMm('0')).toBeNull();
    expect(parseInProgressCmToMm('0.')).toBeNull();
    expect(parseInProgressCmToMm('0.5')).toBeNull();
    expect(parseInProgressCmToMm('0.9')).toBeNull();
  });

  it('returns null for empty / invalid', () => {
    expect(parseInProgressCmToMm('')).toBeNull();
    expect(parseInProgressCmToMm('.')).toBeNull();
    expect(parseInProgressCmToMm('abc')).toBeNull();
  });
});

describe('parseZeroToTen', () => {
  it('accepts valid 0-10 numbers', () => {
    expect(parseZeroToTen('0')).toBe(0);
    expect(parseZeroToTen('3.5')).toBe(3.5);
    expect(parseZeroToTen('10')).toBe(10);
  });

  it('clamps out-of-range to 0 or 10', () => {
    expect(parseZeroToTen('-1')).toBe(0);
    expect(parseZeroToTen('15')).toBe(10);
  });

  it('returns null on empty / invalid', () => {
    expect(parseZeroToTen('')).toBeNull();
    expect(parseZeroToTen('   ')).toBeNull();
    expect(parseZeroToTen('abc')).toBeNull();
  });
});
