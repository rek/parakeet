import { describe, expect, it } from 'vitest';

import { isNetworkError } from './isNetworkError';

describe('isNetworkError', () => {
  it('returns false for non-Error values', () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
    expect(isNetworkError('network request failed')).toBe(false);
    expect(isNetworkError(42)).toBe(false);
  });

  it('returns false for unrelated error messages', () => {
    expect(isNetworkError(new Error('something went wrong'))).toBe(false);
    expect(isNetworkError(new Error('unauthorized'))).toBe(false);
  });

  it('returns true for each recognised network error message', () => {
    expect(isNetworkError(new Error('Network request failed'))).toBe(true);
    expect(isNetworkError(new Error('fetch failed'))).toBe(true);
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new Error('network error'))).toBe(true);
    expect(isNetworkError(new Error('request timeout'))).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(isNetworkError(new Error('NETWORK REQUEST FAILED'))).toBe(true);
    expect(isNetworkError(new Error('TIMEOUT'))).toBe(true);
  });
});
