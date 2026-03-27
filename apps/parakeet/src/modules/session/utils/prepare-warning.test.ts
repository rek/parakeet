import { describe, expect, it } from 'vitest';

import { shouldFirePrepareWarning } from './prepare-warning';

describe('shouldFirePrepareWarning', () => {
  describe('fires when conditions are met', () => {
    it('fires at exactly 15s remaining', () => {
      expect(shouldFirePrepareWarning(15, false, false)).toBe(true);
    });

    it('fires below 15s remaining', () => {
      expect(shouldFirePrepareWarning(14, false, false)).toBe(true);
      expect(shouldFirePrepareWarning(10, false, false)).toBe(true);
      expect(shouldFirePrepareWarning(1, false, false)).toBe(true);
    });
  });

  describe('does not fire when remaining is above threshold', () => {
    it('does not fire at 16s remaining', () => {
      expect(shouldFirePrepareWarning(16, false, false)).toBe(false);
    });

    it('does not fire at 60s remaining', () => {
      expect(shouldFirePrepareWarning(60, false, false)).toBe(false);
    });
  });

  describe('does not fire at or below zero', () => {
    it('does not fire at 0s remaining (overtime boundary)', () => {
      expect(shouldFirePrepareWarning(0, false, false)).toBe(false);
    });

    it('does not fire when remaining is negative', () => {
      expect(shouldFirePrepareWarning(-1, false, false)).toBe(false);
      expect(shouldFirePrepareWarning(-30, false, false)).toBe(false);
    });
  });

  describe('does not fire when already in overtime', () => {
    it('does not fire when overtime=true even if remaining looks valid', () => {
      expect(shouldFirePrepareWarning(10, true, false)).toBe(false);
      expect(shouldFirePrepareWarning(15, true, false)).toBe(false);
    });
  });

  describe('does not fire when already fired this session', () => {
    it('does not re-fire once warnFired=true', () => {
      expect(shouldFirePrepareWarning(15, false, true)).toBe(false);
      expect(shouldFirePrepareWarning(10, false, true)).toBe(false);
      expect(shouldFirePrepareWarning(1, false, true)).toBe(false);
    });
  });

  describe('combined conditions', () => {
    it('does not fire when overtime AND warnFired', () => {
      expect(shouldFirePrepareWarning(10, true, true)).toBe(false);
    });
  });
});
