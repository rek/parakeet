import { describe, expect, it } from 'vitest';

import { checkAllInvariants } from '../invariants';
import { checkMuscleCoverage } from '../invariants/muscle-coverage';
import { checkRpeDrift } from '../invariants/rpe-drift';
import { ADAM, BUSY_BEE, LISA } from '../personas';
import {
  ADHERENT_MODEL,
  BEGINNER_MODEL,
  OVERTRAINED_MODEL,
} from '../personas/performance-models';
import { ADHERENT_FEMALE, ADHERENT_MALE, BUSY_SCRIPT } from '../scripts';
import { runSimulation } from '../simulator';

describe('RPE drift invariant', () => {
  it('does not flag RPE drift for a normal adherent athlete', () => {
    const log = runSimulation({
      persona: ADAM,
      script: ADHERENT_MALE,
      performanceModel: ADHERENT_MODEL,
    });
    const violations = checkRpeDrift(log);
    const errors = violations.filter((v) => v.severity === 'error');
    expect(errors.length).toBe(0);
  });

  it('flags high RPE drift for an overtrained athlete', () => {
    const log = runSimulation({
      persona: ADAM,
      script: ADHERENT_MALE,
      performanceModel: OVERTRAINED_MODEL,
    });
    const violations = checkRpeDrift(log);

    // Overtrained model has rpeDeviation=1.0 + rpeFatiguePerWeek=0.3
    // By week 2-3 within a block, RPE should be 1.6+ above target
    const highDrift = violations.filter((v) => v.rule === 'rpe_drift_high');
    expect(highDrift.length).toBeGreaterThan(0);
  });
});

describe('Muscle coverage invariant', () => {
  it('finds no zero-coverage for core muscles in adherent training', () => {
    const log = runSimulation({
      persona: ADAM,
      script: ADHERENT_MALE,
      performanceModel: ADHERENT_MODEL,
    });
    const violations = checkMuscleCoverage(log);
    const zeroCoverage = violations.filter(
      (v) => v.rule === 'muscle_zero_coverage'
    );
    expect(zeroCoverage.length).toBe(0);
  });

  it('runs muscle coverage check for female athlete without crashing', () => {
    const log = runSimulation({
      persona: LISA,
      script: ADHERENT_FEMALE,
      performanceModel: ADHERENT_MODEL,
    });
    const violations = checkMuscleCoverage(log);
    // Should return an array (may have some zero-coverage due to weekly volume resets)
    expect(Array.isArray(violations)).toBe(true);
    for (const v of violations) {
      expect(v.category).toBe('auxiliary_balance');
      expect(v.rule).toBe('muscle_zero_coverage');
    }
  });
});

describe('All invariants together', () => {
  it('runs all 8 invariant checkers without crashing', () => {
    const log = runSimulation({
      persona: BUSY_BEE,
      script: BUSY_SCRIPT,
      performanceModel: BEGINNER_MODEL,
    });
    const violations = checkAllInvariants(log);

    // Should return an array (may have violations, but shouldn't crash)
    expect(Array.isArray(violations)).toBe(true);

    // Each violation should have required fields
    for (const v of violations) {
      expect(v.category).toBeTruthy();
      expect(v.rule).toBeTruthy();
      expect(v.severity).toMatch(/^(warning|error)$/);
      expect(v.message).toBeTruthy();
    }
  });
});
