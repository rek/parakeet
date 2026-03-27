import { describe, expect, it } from 'vitest';

import { isValidBirthYear, isValidBodyweight } from './profile-validation';

describe('isValidBirthYear', () => {
  it('returns true for a valid 4-digit year', () => {
    expect(isValidBirthYear('1990')).toBe(true);
  });

  it('returns false for a 2-digit year', () => {
    expect(isValidBirthYear('90')).toBe(false);
  });

  it('returns false for a 5-digit year', () => {
    expect(isValidBirthYear('19900')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isValidBirthYear('')).toBe(false);
  });

  it('returns false for non-numeric 4-char string', () => {
    expect(isValidBirthYear('abcd')).toBe(false);
  });

  it('returns false for a string with spaces', () => {
    expect(isValidBirthYear('199 ')).toBe(false);
  });

  it('returns true for another valid year', () => {
    expect(isValidBirthYear('2000')).toBe(true);
  });
});

describe('isValidBodyweight', () => {
  it('returns true for a positive numeric string', () => {
    expect(isValidBodyweight('75')).toBe(true);
  });

  it('returns false for zero', () => {
    expect(isValidBodyweight('0')).toBe(false);
  });

  it('returns false for a negative value', () => {
    expect(isValidBodyweight('-5')).toBe(false);
  });

  it('returns false for an empty string (NaN)', () => {
    expect(isValidBodyweight('')).toBe(false);
  });

  it('returns false for a non-numeric string (NaN)', () => {
    expect(isValidBodyweight('abc')).toBe(false);
  });

  it('returns true for a decimal value', () => {
    expect(isValidBodyweight('72.5')).toBe(true);
  });
});
