import { describe, expect, it } from 'vitest';

import { CYCLE_PHASES } from '../ui/cycle-phase-styles';
import { computePhaseStats, generateInsight } from './phase-statistics';

describe('computePhaseStats', () => {
  it('returns zero sessionCount and null avgRpe for all phases when given empty sessions', () => {
    const stats = computePhaseStats([]);
    for (const phase of CYCLE_PHASES) {
      expect(stats[phase].sessionCount).toBe(0);
      expect(stats[phase].avgRpe).toBeNull();
    }
  });

  it('counts sessions and computes avgRpe correctly for valid cycle phases', () => {
    const stats = computePhaseStats([
      { cycle_phase: 'menstrual', rpe: 8 },
      { cycle_phase: 'menstrual', rpe: 6 },
      { cycle_phase: 'follicular', rpe: 7 },
    ]);
    expect(stats.menstrual.sessionCount).toBe(2);
    expect(stats.menstrual.avgRpe).toBe(7);
    expect(stats.follicular.sessionCount).toBe(1);
    expect(stats.follicular.avgRpe).toBe(7);
    expect(stats.ovulatory.sessionCount).toBe(0);
    expect(stats.ovulatory.avgRpe).toBeNull();
  });

  it('ignores sessions with null cycle_phase', () => {
    const stats = computePhaseStats([
      { cycle_phase: null, rpe: 8 },
      { cycle_phase: 'luteal', rpe: 9 },
    ]);
    expect(stats.luteal.sessionCount).toBe(1);
    // Verify the null-phase session didn't accumulate anywhere
    const totalSessions = CYCLE_PHASES.reduce(
      (sum, p) => sum + stats[p].sessionCount,
      0
    );
    expect(totalSessions).toBe(1);
  });

  it('ignores sessions with an unrecognised cycle_phase string', () => {
    const stats = computePhaseStats([
      { cycle_phase: 'not_a_real_phase', rpe: 8 },
    ]);
    const totalSessions = CYCLE_PHASES.reduce(
      (sum, p) => sum + stats[p].sessionCount,
      0
    );
    expect(totalSessions).toBe(0);
  });

  it('counts sessions with null rpe but excludes them from avgRpe calculation', () => {
    const stats = computePhaseStats([
      { cycle_phase: 'ovulatory', rpe: null },
      { cycle_phase: 'ovulatory', rpe: 8 },
    ]);
    expect(stats.ovulatory.sessionCount).toBe(2);
    expect(stats.ovulatory.avgRpe).toBe(8);
  });

  it('returns null avgRpe when all sessions for a phase have null rpe', () => {
    const stats = computePhaseStats([
      { cycle_phase: 'late_luteal', rpe: null },
      { cycle_phase: 'late_luteal', rpe: null },
    ]);
    expect(stats.late_luteal.sessionCount).toBe(2);
    expect(stats.late_luteal.avgRpe).toBeNull();
  });

  it('averages rpe correctly across multiple sessions', () => {
    const stats = computePhaseStats([
      { cycle_phase: 'luteal', rpe: 6 },
      { cycle_phase: 'luteal', rpe: 7 },
      { cycle_phase: 'luteal', rpe: 8 },
    ]);
    expect(stats.luteal.avgRpe).toBe(7);
  });
});

describe('generateInsight', () => {
  it('returns null when fewer than 2 phases have RPE data', () => {
    const stats = computePhaseStats([{ cycle_phase: 'menstrual', rpe: 8 }]);
    expect(generateInsight(stats)).toBeNull();
  });

  it('returns null when all phases have the same avgRpe (max and min are the same phase)', () => {
    // All phases same RPE — first phase ends up as both max and min
    const stats = computePhaseStats([
      { cycle_phase: 'menstrual', rpe: 7 },
      { cycle_phase: 'follicular', rpe: 7 },
    ]);
    expect(generateInsight(stats)).toBeNull();
  });

  it('returns an insight string mentioning both the highest and lowest RPE phases', () => {
    const stats = computePhaseStats([
      { cycle_phase: 'menstrual', rpe: 9 },
      { cycle_phase: 'follicular', rpe: 5 },
    ]);
    const insight = generateInsight(stats);
    expect(insight).not.toBeNull();
    expect(insight).toContain('menstrual');
    expect(insight).toContain('follicular');
  });

  it('insight string includes formatted RPE values', () => {
    const stats = computePhaseStats([
      { cycle_phase: 'luteal', rpe: 8.5 },
      { cycle_phase: 'ovulatory', rpe: 6.0 },
    ]);
    const insight = generateInsight(stats);
    expect(insight).toContain('8.5');
    expect(insight).toContain('6.0');
  });
});
