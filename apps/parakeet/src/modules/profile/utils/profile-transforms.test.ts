import { describe, expect, it } from 'vitest';
import { birthYearToDobIso, formatBirthYear, formatBodyweight } from './profile-transforms';

describe('birthYearToDobIso', () => {
  it('converts a birth year string to ISO date string with Jan 1', () => {
    expect(birthYearToDobIso('1990')).toBe('1990-01-01');
  });

  it('handles leading zeros by parsing as integer', () => {
    expect(birthYearToDobIso('2000')).toBe('2000-01-01');
  });
});

describe('formatBirthYear', () => {
  it('extracts the year from a full ISO date string', () => {
    expect(formatBirthYear('1990-06-15')).toBe('1990');
  });

  it('returns em-dash for null', () => {
    expect(formatBirthYear(null)).toBe('—');
  });

  it('returns em-dash for undefined', () => {
    expect(formatBirthYear(undefined)).toBe('—');
  });

  it('handles a date at year boundary', () => {
    expect(formatBirthYear('2000-01-01')).toBe('2000');
  });
});

describe('formatBodyweight', () => {
  it('formats a positive number with kg suffix', () => {
    expect(formatBodyweight(75)).toBe('75 kg');
  });

  it('formats zero as "0 kg"', () => {
    expect(formatBodyweight(0)).toBe('0 kg');
  });

  it('returns em-dash for null', () => {
    expect(formatBodyweight(null)).toBe('—');
  });

  it('returns em-dash for undefined', () => {
    expect(formatBodyweight(undefined)).toBe('—');
  });

  it('formats a decimal value', () => {
    expect(formatBodyweight(72.5)).toBe('72.5 kg');
  });
});
