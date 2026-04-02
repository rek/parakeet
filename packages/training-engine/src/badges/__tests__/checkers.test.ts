import { describe, expect, it } from 'vitest';

// ── detectStreakBreakAndRebuild (pure function) ─────────────────────────────

import { detectStreakBreakAndRebuild } from '../../achievements/pr-detection';
import type { WeekStatus } from '../../achievements/pr-detection';
import type {
  BadgeActualSet,
  BadgeCheckContext,
  BadgePlannedSet,
} from '../badge-types';
import { checkConsistencyBadges } from '../checkers/consistency';
import type { ConsistencyData } from '../checkers/consistency';
import { checkCouplesBadges } from '../checkers/couples';
import { checkLiftIdentityBadges } from '../checkers/lift-identity';
import { checkPerformanceBadges } from '../checkers/performance';
import { checkProgramLoyaltyBadges } from '../checkers/program-loyalty';
import type { ProgramLoyaltyData } from '../checkers/program-loyalty';
import { checkRestPacingBadges } from '../checkers/rest-pacing';
import { checkRpeEffortBadges } from '../checkers/rpe-effort';
import { checkSessionMilestoneBadges } from '../checkers/session-milestones';
import { checkSituationalBadges } from '../checkers/situational';
import { checkVolumeRepBadges } from '../checkers/volume-rep';
import { checkWildRareBadges } from '../checkers/wild-rare';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeActualSet(
  overrides: Partial<BadgeActualSet> = {}
): BadgeActualSet {
  return {
    set_number: 1,
    weight_grams: 100_000,
    reps_completed: 5,
    is_completed: true,
    ...overrides,
  };
}

function makePlannedSet(
  overrides: Partial<BadgePlannedSet> = {}
): BadgePlannedSet {
  return {
    set_number: 1,
    weight_grams: 100_000,
    reps: 5,
    ...overrides,
  };
}

function makeCtx(
  overrides: Partial<BadgeCheckContext> = {}
): BadgeCheckContext {
  return {
    sessionId: 'session-001',
    actualSets: [],
    plannedSets: [],
    startedAt: null,
    completedAt: null,
    durationSeconds: null,
    primaryLift: null,
    isDeload: false,
    programId: 'program-001',
    earnedPRs: [],
    totalCompletedSessions: 10,
    completedCycles: 0,
    allLiftE1RMs: {},
    bodyweightKg: null,
    streakWeeks: 0,
    sleepQuality: null,
    energyLevel: null,
    hasActiveMajorDisruption: false,
    daysSinceLastDisruption: null,
    lastDisruptionDurationDays: null,
    completedAtHour: null,
    previousSessionWasDeload: false,
    previousE1Rm: {},
    volumePrCount: 0,
    oneRmPrCount: 0,
    uniqueAuxExercisesInCycle: 0,
    consecutiveFullRestSessions: 0,
    hadStreakBreakAndRebuild: false,
    partnerCompletedToday: false,
    ...overrides,
  };
}

function makeConsistencyData(
  overrides: Partial<ConsistencyData> = {}
): ConsistencyData {
  return {
    sessionsBeforeSixAm: 0,
    sessionsAfterNinePm: 0,
    distinctSundaySessions: 0,
    streakWeeks: 0,
    consecutiveLegDaySessions: 0,
    isPerfectWeek: false,
    consecutivePerfectSessions: 0,
    ...overrides,
  };
}

function makeProgramLoyaltyData(
  overrides: Partial<ProgramLoyaltyData> = {}
): ProgramLoyaltyData {
  return {
    consecutiveSameFormulaCycles: 0,
    formulaChangesThisCycle: 0,
    consecutiveCyclesWithoutDeload: 0,
    ...overrides,
  };
}

// ── checkPerformanceBadges ───────────────────────────────────────────────────

describe('checkPerformanceBadges', () => {
  describe('the_tonne — session volume >= 10,000 kg', () => {
    it('earns badge when volume is exactly 10,000 kg', () => {
      // 10 sets × 200 kg × 5 reps = 10,000 kg
      const sets = Array.from({ length: 10 }, (_, i) =>
        makeActualSet({
          set_number: i + 1,
          weight_grams: 200_000,
          reps_completed: 5,
        })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkPerformanceBadges(ctx)).toContain('the_tonne');
    });

    it('earns badge when volume exceeds 10,000 kg', () => {
      // 5 sets × 300 kg × 8 reps = 12,000 kg
      const sets = Array.from({ length: 5 }, (_, i) =>
        makeActualSet({
          set_number: i + 1,
          weight_grams: 300_000,
          reps_completed: 8,
        })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkPerformanceBadges(ctx)).toContain('the_tonne');
    });

    it('does not earn badge when volume is just under 10,000 kg', () => {
      // 9 sets × 200 kg × 5 reps = 9,000 kg
      const sets = Array.from({ length: 9 }, (_, i) =>
        makeActualSet({
          set_number: i + 1,
          weight_grams: 200_000,
          reps_completed: 5,
        })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkPerformanceBadges(ctx)).not.toContain('the_tonne');
    });

    it('skips incomplete sets in volume calculation', () => {
      // 10 sets but 5 incomplete — volume = 5 × 200 kg × 5 reps = 5,000 kg
      const sets = Array.from({ length: 10 }, (_, i) =>
        makeActualSet({
          set_number: i + 1,
          weight_grams: 200_000,
          reps_completed: 5,
          is_completed: i < 5,
        })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkPerformanceBadges(ctx)).not.toContain('the_tonne');
    });
  });

  describe('the_centurion — 100+ reps of primary lift', () => {
    it('earns badge when 100 reps completed with primaryLift set', () => {
      const sets = Array.from({ length: 10 }, (_, i) =>
        makeActualSet({ set_number: i + 1, reps_completed: 10 })
      );
      const ctx = makeCtx({ actualSets: sets, primaryLift: 'squat' });
      expect(checkPerformanceBadges(ctx)).toContain('the_centurion');
    });

    it('earns badge when reps exceed 100', () => {
      const sets = Array.from({ length: 5 }, (_, i) =>
        makeActualSet({ set_number: i + 1, reps_completed: 25 })
      );
      const ctx = makeCtx({ actualSets: sets, primaryLift: 'deadlift' });
      expect(checkPerformanceBadges(ctx)).toContain('the_centurion');
    });

    it('does not earn badge at 99 reps', () => {
      // 9 sets × 11 reps = 99
      const sets = Array.from({ length: 9 }, (_, i) =>
        makeActualSet({ set_number: i + 1, reps_completed: 11 })
      );
      const ctx = makeCtx({ actualSets: sets, primaryLift: 'bench' });
      expect(checkPerformanceBadges(ctx)).not.toContain('the_centurion');
    });

    it('does not earn badge when primaryLift is null', () => {
      const sets = Array.from({ length: 10 }, (_, i) =>
        makeActualSet({ set_number: i + 1, reps_completed: 15 })
      );
      const ctx = makeCtx({ actualSets: sets, primaryLift: null });
      expect(checkPerformanceBadges(ctx)).not.toContain('the_centurion');
    });
  });

  describe('gravity_meet_your_match — any e1RM > bodyweight', () => {
    it('earns badge when squat e1RM exceeds bodyweight', () => {
      const ctx = makeCtx({
        bodyweightKg: 80,
        allLiftE1RMs: { squat: 90 },
      });
      expect(checkPerformanceBadges(ctx)).toContain('gravity_meet_your_match');
    });

    it('does not earn badge when no lift exceeds bodyweight', () => {
      const ctx = makeCtx({
        bodyweightKg: 100,
        allLiftE1RMs: { squat: 80, bench: 60, deadlift: 95 },
      });
      expect(checkPerformanceBadges(ctx)).not.toContain(
        'gravity_meet_your_match'
      );
    });

    it('does not earn badge when bodyweightKg is null', () => {
      const ctx = makeCtx({
        bodyweightKg: null,
        allLiftE1RMs: { squat: 200 },
      });
      expect(checkPerformanceBadges(ctx)).not.toContain(
        'gravity_meet_your_match'
      );
    });
  });

  describe('sir_isaacs_worst_nightmare — any e1RM > 2× bodyweight', () => {
    it('earns badge when deadlift e1RM exceeds 2× bodyweight', () => {
      const ctx = makeCtx({
        bodyweightKg: 80,
        allLiftE1RMs: { deadlift: 165 },
      });
      expect(checkPerformanceBadges(ctx)).toContain(
        'sir_isaacs_worst_nightmare'
      );
    });

    it('does not earn when e1RM is exactly 2× bodyweight (not strictly greater)', () => {
      const ctx = makeCtx({
        bodyweightKg: 80,
        allLiftE1RMs: { deadlift: 160 },
      });
      expect(checkPerformanceBadges(ctx)).not.toContain(
        'sir_isaacs_worst_nightmare'
      );
    });

    it('does not earn when best lift is 1.9× bodyweight', () => {
      const ctx = makeCtx({
        bodyweightKg: 100,
        allLiftE1RMs: { squat: 190 },
      });
      expect(checkPerformanceBadges(ctx)).not.toContain(
        'sir_isaacs_worst_nightmare'
      );
    });
  });

  describe('round_number_enjoyer — e1RM PR on a round number', () => {
    it('earns badge when e1RM PR is exactly 100 kg', () => {
      const ctx = makeCtx({
        earnedPRs: [{ type: 'estimated_1rm', lift: 'squat', value: 100 }],
      });
      expect(checkPerformanceBadges(ctx)).toContain('round_number_enjoyer');
    });

    it('earns badge for other round numbers like 200 kg', () => {
      const ctx = makeCtx({
        earnedPRs: [{ type: 'estimated_1rm', lift: 'deadlift', value: 200 }],
      });
      expect(checkPerformanceBadges(ctx)).toContain('round_number_enjoyer');
    });

    it('does not earn badge for a non-round PR value', () => {
      const ctx = makeCtx({
        earnedPRs: [{ type: 'estimated_1rm', lift: 'bench', value: 105.5 }],
      });
      expect(checkPerformanceBadges(ctx)).not.toContain('round_number_enjoyer');
    });

    it('does not earn badge for volume PR on a round number (wrong type)', () => {
      const ctx = makeCtx({
        earnedPRs: [{ type: 'volume', lift: 'squat', value: 100 }],
      });
      expect(checkPerformanceBadges(ctx)).not.toContain('round_number_enjoyer');
    });

    it('earns badge when PR value rounds to a round number', () => {
      // Math.round(99.6) = 100
      const ctx = makeCtx({
        earnedPRs: [{ type: 'estimated_1rm', lift: 'bench', value: 99.6 }],
      });
      expect(checkPerformanceBadges(ctx)).toContain('round_number_enjoyer');
    });
  });

  describe('triple_threat — all 3 PR types in one session', () => {
    it('earns badge when all three PR types are present', () => {
      const ctx = makeCtx({
        earnedPRs: [
          { type: 'estimated_1rm', lift: 'squat', value: 150 },
          { type: 'volume', lift: 'squat', value: 4500 },
          { type: 'rep_at_weight', lift: 'squat', value: 8 },
        ],
      });
      expect(checkPerformanceBadges(ctx)).toContain('triple_threat');
    });

    it('does not earn badge when only two PR types are present', () => {
      const ctx = makeCtx({
        earnedPRs: [
          { type: 'estimated_1rm', lift: 'squat', value: 150 },
          { type: 'volume', lift: 'squat', value: 4500 },
        ],
      });
      expect(checkPerformanceBadges(ctx)).not.toContain('triple_threat');
    });

    it('does not earn badge with no PRs', () => {
      const ctx = makeCtx({ earnedPRs: [] });
      expect(checkPerformanceBadges(ctx)).not.toContain('triple_threat');
    });
  });

  describe('technically_a_pr — e1RM PR by 0.5–1.25 kg margin', () => {
    it('earns badge when e1RM improves by exactly 1.25 kg', () => {
      const ctx = makeCtx({
        earnedPRs: [{ type: 'estimated_1rm', lift: 'squat', value: 151.25 }],
        previousE1Rm: { squat: 150 },
      });
      expect(checkPerformanceBadges(ctx)).toContain('technically_a_pr');
    });

    it('earns badge when e1RM improves by a small margin like 0.7 kg', () => {
      const ctx = makeCtx({
        earnedPRs: [{ type: 'estimated_1rm', lift: 'bench', value: 100.7 }],
        previousE1Rm: { bench: 100 },
      });
      expect(checkPerformanceBadges(ctx)).toContain('technically_a_pr');
    });

    it('does not earn badge when improvement exceeds 1.25 kg', () => {
      const ctx = makeCtx({
        earnedPRs: [{ type: 'estimated_1rm', lift: 'squat', value: 153 }],
        previousE1Rm: { squat: 150 },
      });
      expect(checkPerformanceBadges(ctx)).not.toContain('technically_a_pr');
    });

    it('does not earn badge when there is no previous best (first PR ever)', () => {
      const ctx = makeCtx({
        earnedPRs: [{ type: 'estimated_1rm', lift: 'squat', value: 100 }],
        previousE1Rm: {},
      });
      expect(checkPerformanceBadges(ctx)).not.toContain('technically_a_pr');
    });

    it('does not earn badge when diff is exactly 0 (no improvement)', () => {
      const ctx = makeCtx({
        earnedPRs: [{ type: 'estimated_1rm', lift: 'squat', value: 150 }],
        previousE1Rm: { squat: 150 },
      });
      expect(checkPerformanceBadges(ctx)).not.toContain('technically_a_pr');
    });
  });
});

// ── checkSituationalBadges ───────────────────────────────────────────────────

describe('checkSituationalBadges', () => {
  describe('comeback_kid — PR within 14 days of 7+ day disruption', () => {
    it('earns badge when PR follows a 7-day disruption within 14 days', () => {
      const ctx = makeCtx({
        earnedPRs: [{ type: 'estimated_1rm', lift: 'squat', value: 150 }],
        lastDisruptionDurationDays: 7,
        daysSinceLastDisruption: 10,
      });
      expect(checkSituationalBadges(ctx)).toContain('comeback_kid');
    });

    it('does not earn badge when disruption was only 6 days', () => {
      const ctx = makeCtx({
        earnedPRs: [{ type: 'estimated_1rm', lift: 'squat', value: 150 }],
        lastDisruptionDurationDays: 6,
        daysSinceLastDisruption: 5,
      });
      expect(checkSituationalBadges(ctx)).not.toContain('comeback_kid');
    });

    it('does not earn badge when days since disruption exceeds 14', () => {
      const ctx = makeCtx({
        earnedPRs: [{ type: 'estimated_1rm', lift: 'squat', value: 150 }],
        lastDisruptionDurationDays: 10,
        daysSinceLastDisruption: 15,
      });
      expect(checkSituationalBadges(ctx)).not.toContain('comeback_kid');
    });

    it('does not earn badge when there are no PRs', () => {
      const ctx = makeCtx({
        earnedPRs: [],
        lastDisruptionDurationDays: 14,
        daysSinceLastDisruption: 5,
      });
      expect(checkSituationalBadges(ctx)).not.toContain('comeback_kid');
    });
  });

  describe('didnt_want_to_be_here — poor sleep + low energy + 100% completion', () => {
    it('earns badge with sleep=1, energy=1, and all sets completed', () => {
      const planned = [
        makePlannedSet({ set_number: 1 }),
        makePlannedSet({ set_number: 2 }),
      ];
      const actual = [
        makeActualSet({ set_number: 1, is_completed: true }),
        makeActualSet({ set_number: 2, is_completed: true }),
      ];
      const ctx = makeCtx({
        sleepQuality: 1,
        energyLevel: 1,
        plannedSets: planned,
        actualSets: actual,
      });
      expect(checkSituationalBadges(ctx)).toContain('didnt_want_to_be_here');
    });

    it('does not earn badge when sleep is 2', () => {
      const ctx = makeCtx({
        sleepQuality: 2,
        energyLevel: 1,
        plannedSets: [makePlannedSet()],
        actualSets: [makeActualSet()],
      });
      expect(checkSituationalBadges(ctx)).not.toContain(
        'didnt_want_to_be_here'
      );
    });

    it('does not earn badge when energy is 2', () => {
      const ctx = makeCtx({
        sleepQuality: 1,
        energyLevel: 2,
        plannedSets: [makePlannedSet()],
        actualSets: [makeActualSet()],
      });
      expect(checkSituationalBadges(ctx)).not.toContain(
        'didnt_want_to_be_here'
      );
    });

    it('does not earn badge when some sets are incomplete', () => {
      const planned = [
        makePlannedSet({ set_number: 1 }),
        makePlannedSet({ set_number: 2 }),
      ];
      const actual = [
        makeActualSet({ set_number: 1, is_completed: true }),
        makeActualSet({ set_number: 2, is_completed: false }),
      ];
      const ctx = makeCtx({
        sleepQuality: 1,
        energyLevel: 1,
        plannedSets: planned,
        actualSets: actual,
      });
      expect(checkSituationalBadges(ctx)).not.toContain(
        'didnt_want_to_be_here'
      );
    });

    it('does not earn badge when plannedSets is empty', () => {
      const ctx = makeCtx({
        sleepQuality: 1,
        energyLevel: 1,
        plannedSets: [],
        actualSets: [makeActualSet()],
      });
      expect(checkSituationalBadges(ctx)).not.toContain(
        'didnt_want_to_be_here'
      );
    });
  });

  describe('one_more_rep — actual reps > planned reps on 3+ sets', () => {
    it('earns badge when 3 sets have extra reps', () => {
      const planned = [
        makePlannedSet({ set_number: 1, reps: 5 }),
        makePlannedSet({ set_number: 2, reps: 5 }),
        makePlannedSet({ set_number: 3, reps: 5 }),
      ];
      const actual = [
        makeActualSet({ set_number: 1, reps_completed: 6 }),
        makeActualSet({ set_number: 2, reps_completed: 6 }),
        makeActualSet({ set_number: 3, reps_completed: 7 }),
      ];
      const ctx = makeCtx({ actualSets: actual, plannedSets: planned });
      expect(checkSituationalBadges(ctx)).toContain('one_more_rep');
    });

    it('does not earn badge when only 2 sets have extra reps', () => {
      const planned = [
        makePlannedSet({ set_number: 1, reps: 5 }),
        makePlannedSet({ set_number: 2, reps: 5 }),
        makePlannedSet({ set_number: 3, reps: 5 }),
      ];
      const actual = [
        makeActualSet({ set_number: 1, reps_completed: 6 }),
        makeActualSet({ set_number: 2, reps_completed: 6 }),
        makeActualSet({ set_number: 3, reps_completed: 5 }),
      ];
      const ctx = makeCtx({ actualSets: actual, plannedSets: planned });
      expect(checkSituationalBadges(ctx)).not.toContain('one_more_rep');
    });

    it('does not count extra reps from incomplete sets', () => {
      const planned = [
        makePlannedSet({ set_number: 1, reps: 5 }),
        makePlannedSet({ set_number: 2, reps: 5 }),
        makePlannedSet({ set_number: 3, reps: 5 }),
      ];
      const actual = [
        makeActualSet({
          set_number: 1,
          reps_completed: 8,
          is_completed: false,
        }),
        makeActualSet({
          set_number: 2,
          reps_completed: 8,
          is_completed: false,
        }),
        makeActualSet({
          set_number: 3,
          reps_completed: 8,
          is_completed: false,
        }),
      ];
      const ctx = makeCtx({ actualSets: actual, plannedSets: planned });
      expect(checkSituationalBadges(ctx)).not.toContain('one_more_rep');
    });
  });

  describe('plate_math_phd — 5+ distinct weight values', () => {
    it('earns badge with 5 distinct weights', () => {
      const sets = [60, 80, 100, 120, 140].map((kg, i) =>
        makeActualSet({ set_number: i + 1, weight_grams: kg * 1000 })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkSituationalBadges(ctx)).toContain('plate_math_phd');
    });

    it('does not earn badge with only 4 distinct weights', () => {
      const sets = [60, 80, 100, 120, 120].map((kg, i) =>
        makeActualSet({ set_number: i + 1, weight_grams: kg * 1000 })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkSituationalBadges(ctx)).not.toContain('plate_math_phd');
    });

    it('does not count incomplete sets toward distinct weights', () => {
      const sets = [60, 80, 100, 120, 140].map((kg, i) =>
        makeActualSet({
          set_number: i + 1,
          weight_grams: kg * 1000,
          is_completed: i < 4, // only 4 completed
        })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkSituationalBadges(ctx)).not.toContain('plate_math_phd');
    });
  });

  describe('sandbagger — rep-at-weight PR on the final set', () => {
    it('earns badge when final set matches a rep_at_weight PR weight', () => {
      const sets = [
        makeActualSet({ set_number: 1, weight_grams: 100_000 }),
        makeActualSet({ set_number: 2, weight_grams: 140_000 }),
      ];
      const ctx = makeCtx({
        actualSets: sets,
        earnedPRs: [
          { type: 'rep_at_weight', lift: 'squat', value: 8, weightKg: 140 },
        ],
      });
      expect(checkSituationalBadges(ctx)).toContain('sandbagger');
    });

    it('does not earn badge when PR is not on the final set weight', () => {
      const sets = [
        makeActualSet({ set_number: 1, weight_grams: 140_000 }),
        makeActualSet({ set_number: 2, weight_grams: 100_000 }),
      ];
      const ctx = makeCtx({
        actualSets: sets,
        earnedPRs: [
          { type: 'rep_at_weight', lift: 'squat', value: 8, weightKg: 140 },
        ],
      });
      expect(checkSituationalBadges(ctx)).not.toContain('sandbagger');
    });

    it('does not earn badge when final set is incomplete', () => {
      const sets = [
        makeActualSet({ set_number: 1, weight_grams: 100_000 }),
        makeActualSet({
          set_number: 2,
          weight_grams: 140_000,
          is_completed: false,
        }),
      ];
      const ctx = makeCtx({
        actualSets: sets,
        earnedPRs: [
          { type: 'rep_at_weight', lift: 'squat', value: 8, weightKg: 140 },
        ],
      });
      expect(checkSituationalBadges(ctx)).not.toContain('sandbagger');
    });
  });

  describe('bad_day_survivor — 50%+ completion with active major disruption', () => {
    it('earns badge when disruption is active and 50% sets completed', () => {
      const planned = Array.from({ length: 4 }, (_, i) =>
        makePlannedSet({ set_number: i + 1 })
      );
      const actual = [
        makeActualSet({ set_number: 1, is_completed: true }),
        makeActualSet({ set_number: 2, is_completed: true }),
        makeActualSet({ set_number: 3, is_completed: false }),
        makeActualSet({ set_number: 4, is_completed: false }),
      ];
      const ctx = makeCtx({
        hasActiveMajorDisruption: true,
        plannedSets: planned,
        actualSets: actual,
      });
      expect(checkSituationalBadges(ctx)).toContain('bad_day_survivor');
    });

    it('does not earn badge when completion is below 50%', () => {
      const planned = Array.from({ length: 4 }, (_, i) =>
        makePlannedSet({ set_number: i + 1 })
      );
      const actual = [
        makeActualSet({ set_number: 1, is_completed: true }),
        makeActualSet({ set_number: 2, is_completed: false }),
        makeActualSet({ set_number: 3, is_completed: false }),
        makeActualSet({ set_number: 4, is_completed: false }),
      ];
      const ctx = makeCtx({
        hasActiveMajorDisruption: true,
        plannedSets: planned,
        actualSets: actual,
      });
      expect(checkSituationalBadges(ctx)).not.toContain('bad_day_survivor');
    });

    it('does not earn badge when no active major disruption', () => {
      const planned = [makePlannedSet()];
      const actual = [makeActualSet()];
      const ctx = makeCtx({
        hasActiveMajorDisruption: false,
        plannedSets: planned,
        actualSets: actual,
      });
      expect(checkSituationalBadges(ctx)).not.toContain('bad_day_survivor');
    });
  });

  describe('the_grinder — RPE 9.5+ on 3+ sets', () => {
    it('earns badge with exactly 3 sets at RPE 9.5', () => {
      const sets = Array.from({ length: 3 }, (_, i) =>
        makeActualSet({ set_number: i + 1, rpe_actual: 9.5 })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkSituationalBadges(ctx)).toContain('the_grinder');
    });

    it('earns badge with 3+ sets at RPE 10', () => {
      const sets = Array.from({ length: 4 }, (_, i) =>
        makeActualSet({ set_number: i + 1, rpe_actual: 10 })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkSituationalBadges(ctx)).toContain('the_grinder');
    });

    it('does not earn badge with only 2 high-RPE sets', () => {
      const sets = [
        makeActualSet({ set_number: 1, rpe_actual: 9.5 }),
        makeActualSet({ set_number: 2, rpe_actual: 9.5 }),
        makeActualSet({ set_number: 3, rpe_actual: 8.0 }),
      ];
      const ctx = makeCtx({ actualSets: sets });
      expect(checkSituationalBadges(ctx)).not.toContain('the_grinder');
    });

    it('does not earn badge with RPE 9.0 (below threshold)', () => {
      const sets = Array.from({ length: 5 }, (_, i) =>
        makeActualSet({ set_number: i + 1, rpe_actual: 9.0 })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkSituationalBadges(ctx)).not.toContain('the_grinder');
    });
  });

  describe('tactical_retreat — PR right after a deload', () => {
    it('earns badge when previous session was deload and a PR was earned', () => {
      const ctx = makeCtx({
        previousSessionWasDeload: true,
        earnedPRs: [{ type: 'estimated_1rm', lift: 'squat', value: 155 }],
      });
      expect(checkSituationalBadges(ctx)).toContain('tactical_retreat');
    });

    it('does not earn badge without a PR', () => {
      const ctx = makeCtx({
        previousSessionWasDeload: true,
        earnedPRs: [],
      });
      expect(checkSituationalBadges(ctx)).not.toContain('tactical_retreat');
    });

    it('does not earn badge when previous session was not a deload', () => {
      const ctx = makeCtx({
        previousSessionWasDeload: false,
        earnedPRs: [{ type: 'estimated_1rm', lift: 'squat', value: 155 }],
      });
      expect(checkSituationalBadges(ctx)).not.toContain('tactical_retreat');
    });
  });
});

// ── checkRpeEffortBadges ─────────────────────────────────────────────────────

describe('checkRpeEffortBadges', () => {
  describe('rpe_whisperer — all 8+ sets within 0.5 of prescribed RPE', () => {
    it('earns badge with 8 sets all exactly on target RPE', () => {
      const sets = Array.from({ length: 8 }, (_, i) => ({
        actual: makeActualSet({ set_number: i + 1, rpe_actual: 8.0 }),
        planned: makePlannedSet({ set_number: i + 1, rpe_target: 8.0 }),
      }));
      const ctx = makeCtx({
        actualSets: sets.map((s) => s.actual),
        plannedSets: sets.map((s) => s.planned),
      });
      expect(checkRpeEffortBadges(ctx)).toContain('rpe_whisperer');
    });

    it('earns badge when all sets are within 0.5 of target', () => {
      const actuals = Array.from({ length: 8 }, (_, i) =>
        makeActualSet({ set_number: i + 1, rpe_actual: 8.5 })
      );
      const planned = Array.from({ length: 8 }, (_, i) =>
        makePlannedSet({ set_number: i + 1, rpe_target: 8.0 })
      );
      const ctx = makeCtx({ actualSets: actuals, plannedSets: planned });
      expect(checkRpeEffortBadges(ctx)).toContain('rpe_whisperer');
    });

    it('does not earn badge when one set exceeds 0.5 deviation', () => {
      const actuals = Array.from({ length: 8 }, (_, i) =>
        makeActualSet({ set_number: i + 1, rpe_actual: i === 7 ? 9.0 : 8.0 })
      );
      const planned = Array.from({ length: 8 }, (_, i) =>
        makePlannedSet({ set_number: i + 1, rpe_target: 8.0 })
      );
      const ctx = makeCtx({ actualSets: actuals, plannedSets: planned });
      expect(checkRpeEffortBadges(ctx)).not.toContain('rpe_whisperer');
    });

    it('does not earn badge with only 7 sets (below minimum)', () => {
      const actuals = Array.from({ length: 7 }, (_, i) =>
        makeActualSet({ set_number: i + 1, rpe_actual: 8.0 })
      );
      const planned = Array.from({ length: 7 }, (_, i) =>
        makePlannedSet({ set_number: i + 1, rpe_target: 8.0 })
      );
      const ctx = makeCtx({ actualSets: actuals, plannedSets: planned });
      expect(checkRpeEffortBadges(ctx)).not.toContain('rpe_whisperer');
    });
  });

  describe('sandbag_detected — every set RPE 6 or below', () => {
    it('earns badge when all sets are at RPE 6', () => {
      const sets = Array.from({ length: 4 }, (_, i) =>
        makeActualSet({ set_number: i + 1, rpe_actual: 6 })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkRpeEffortBadges(ctx)).toContain('sandbag_detected');
    });

    it('earns badge when all sets are below RPE 6', () => {
      const sets = Array.from({ length: 4 }, (_, i) =>
        makeActualSet({ set_number: i + 1, rpe_actual: 5 })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkRpeEffortBadges(ctx)).toContain('sandbag_detected');
    });

    it('does not earn badge when any set is above RPE 6', () => {
      const sets = [
        makeActualSet({ set_number: 1, rpe_actual: 6 }),
        makeActualSet({ set_number: 2, rpe_actual: 6 }),
        makeActualSet({ set_number: 3, rpe_actual: 6.5 }),
      ];
      const ctx = makeCtx({ actualSets: sets });
      expect(checkRpeEffortBadges(ctx)).not.toContain('sandbag_detected');
    });

    it('does not earn badge when no sets have RPE data', () => {
      const sets = Array.from({ length: 4 }, (_, i) =>
        makeActualSet({ set_number: i + 1, rpe_actual: undefined })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkRpeEffortBadges(ctx)).not.toContain('sandbag_detected');
    });
  });

  describe('send_it — RPE 10 on a non-last set', () => {
    it('earns badge when an early set is RPE 10', () => {
      const sets = [
        makeActualSet({ set_number: 1, rpe_actual: 10 }),
        makeActualSet({ set_number: 2, rpe_actual: 8 }),
        makeActualSet({ set_number: 3, rpe_actual: 7 }),
      ];
      const ctx = makeCtx({ actualSets: sets });
      expect(checkRpeEffortBadges(ctx)).toContain('send_it');
    });

    it('does not earn badge when only the last set is RPE 10', () => {
      const sets = [
        makeActualSet({ set_number: 1, rpe_actual: 8 }),
        makeActualSet({ set_number: 2, rpe_actual: 8.5 }),
        makeActualSet({ set_number: 3, rpe_actual: 10 }),
      ];
      const ctx = makeCtx({ actualSets: sets });
      expect(checkRpeEffortBadges(ctx)).not.toContain('send_it');
    });

    it('does not earn badge on an incomplete set even if RPE 10', () => {
      const sets = [
        makeActualSet({ set_number: 1, rpe_actual: 10, is_completed: false }),
        makeActualSet({ set_number: 2, rpe_actual: 8 }),
      ];
      const ctx = makeCtx({ actualSets: sets });
      expect(checkRpeEffortBadges(ctx)).not.toContain('send_it');
    });

    it('returns empty when there are no completed sets with RPE', () => {
      const ctx = makeCtx({ actualSets: [] });
      expect(checkRpeEffortBadges(ctx)).toEqual([]);
    });
  });
});

// ── checkVolumeRepBadges ─────────────────────────────────────────────────────

describe('checkVolumeRepBadges', () => {
  describe('rep_machine — 50+ reps of a primary lift', () => {
    it('earns badge with exactly 50 reps', () => {
      const sets = Array.from({ length: 10 }, (_, i) =>
        makeActualSet({ set_number: i + 1, reps_completed: 5 })
      );
      const ctx = makeCtx({ actualSets: sets, primaryLift: 'bench' });
      expect(checkVolumeRepBadges(ctx)).toContain('rep_machine');
    });

    it('earns badge with more than 50 reps', () => {
      const sets = Array.from({ length: 5 }, (_, i) =>
        makeActualSet({ set_number: i + 1, reps_completed: 15 })
      );
      const ctx = makeCtx({ actualSets: sets, primaryLift: 'squat' });
      expect(checkVolumeRepBadges(ctx)).toContain('rep_machine');
    });

    it('does not earn badge at 49 reps', () => {
      // 7 sets × 7 reps = 49
      const sets = Array.from({ length: 7 }, (_, i) =>
        makeActualSet({ set_number: i + 1, reps_completed: 7 })
      );
      const ctx = makeCtx({ actualSets: sets, primaryLift: 'deadlift' });
      expect(checkVolumeRepBadges(ctx)).not.toContain('rep_machine');
    });

    it('does not earn badge without a primaryLift', () => {
      const sets = Array.from({ length: 10 }, (_, i) =>
        makeActualSet({ set_number: i + 1, reps_completed: 10 })
      );
      const ctx = makeCtx({ actualSets: sets, primaryLift: null });
      expect(checkVolumeRepBadges(ctx)).not.toContain('rep_machine');
    });

    it('returns empty when no sets are completed', () => {
      const sets = Array.from({ length: 5 }, (_, i) =>
        makeActualSet({
          set_number: i + 1,
          reps_completed: 20,
          is_completed: false,
        })
      );
      const ctx = makeCtx({ actualSets: sets, primaryLift: 'squat' });
      expect(checkVolumeRepBadges(ctx)).toEqual([]);
    });
  });

  describe('singles_club — every set is a single rep', () => {
    it('earns badge when all sets are singles', () => {
      const sets = Array.from({ length: 5 }, (_, i) =>
        makeActualSet({ set_number: i + 1, reps_completed: 1 })
      );
      const ctx = makeCtx({ actualSets: sets, primaryLift: 'squat' });
      expect(checkVolumeRepBadges(ctx)).toContain('singles_club');
    });

    it('does not earn badge when any set has more than 1 rep', () => {
      const sets = [
        makeActualSet({ set_number: 1, reps_completed: 1 }),
        makeActualSet({ set_number: 2, reps_completed: 1 }),
        makeActualSet({ set_number: 3, reps_completed: 2 }),
      ];
      const ctx = makeCtx({ actualSets: sets, primaryLift: 'deadlift' });
      expect(checkVolumeRepBadges(ctx)).not.toContain('singles_club');
    });

    it('does not earn badge without a primaryLift', () => {
      const sets = Array.from({ length: 3 }, (_, i) =>
        makeActualSet({ set_number: i + 1, reps_completed: 1 })
      );
      const ctx = makeCtx({ actualSets: sets, primaryLift: null });
      expect(checkVolumeRepBadges(ctx)).not.toContain('singles_club');
    });
  });
});

// ── checkSessionMilestoneBadges ──────────────────────────────────────────────

describe('checkSessionMilestoneBadges', () => {
  describe('first_blood — very first session', () => {
    it('earns badge when totalCompletedSessions is 1', () => {
      const ctx = makeCtx({ totalCompletedSessions: 1 });
      expect(checkSessionMilestoneBadges(ctx)).toContain('first_blood');
    });

    it('does not earn badge at session 2', () => {
      const ctx = makeCtx({ totalCompletedSessions: 2 });
      expect(checkSessionMilestoneBadges(ctx)).not.toContain('first_blood');
    });

    it('does not earn badge at session 0', () => {
      const ctx = makeCtx({ totalCompletedSessions: 0 });
      expect(checkSessionMilestoneBadges(ctx)).not.toContain('first_blood');
    });
  });

  describe('parakeet_og — first completed cycle', () => {
    it('earns badge when completedCycles is 1', () => {
      const ctx = makeCtx({ completedCycles: 1 });
      expect(checkSessionMilestoneBadges(ctx)).toContain('parakeet_og');
    });

    it('earns badge for multiple completed cycles', () => {
      const ctx = makeCtx({ completedCycles: 5 });
      expect(checkSessionMilestoneBadges(ctx)).toContain('parakeet_og');
    });

    it('does not earn badge with 0 completed cycles', () => {
      const ctx = makeCtx({ completedCycles: 0 });
      expect(checkSessionMilestoneBadges(ctx)).not.toContain('parakeet_og');
    });
  });

  describe('century_club — 100 sessions', () => {
    it('earns badge at exactly 100 sessions', () => {
      const ctx = makeCtx({ totalCompletedSessions: 100 });
      expect(checkSessionMilestoneBadges(ctx)).toContain('century_club');
    });

    it('earns badge above 100 sessions', () => {
      const ctx = makeCtx({ totalCompletedSessions: 250 });
      expect(checkSessionMilestoneBadges(ctx)).toContain('century_club');
    });

    it('does not earn badge at 99 sessions', () => {
      const ctx = makeCtx({ totalCompletedSessions: 99 });
      expect(checkSessionMilestoneBadges(ctx)).not.toContain('century_club');
    });
  });

  describe('five_hundred_club — 500 sessions', () => {
    it('earns badge at exactly 500 sessions', () => {
      const ctx = makeCtx({ totalCompletedSessions: 500 });
      expect(checkSessionMilestoneBadges(ctx)).toContain('five_hundred_club');
    });

    it('earns badge above 500 sessions', () => {
      const ctx = makeCtx({ totalCompletedSessions: 501 });
      expect(checkSessionMilestoneBadges(ctx)).toContain('five_hundred_club');
    });

    it('does not earn badge at 499 sessions', () => {
      const ctx = makeCtx({ totalCompletedSessions: 499 });
      expect(checkSessionMilestoneBadges(ctx)).not.toContain(
        'five_hundred_club'
      );
    });

    it('earns both century_club and five_hundred_club at 500', () => {
      const ctx = makeCtx({ totalCompletedSessions: 500 });
      const badges = checkSessionMilestoneBadges(ctx);
      expect(badges).toContain('century_club');
      expect(badges).toContain('five_hundred_club');
    });
  });
});

// ── checkWildRareBadges ──────────────────────────────────────────────────────

describe('checkWildRareBadges', () => {
  describe('ghost_protocol — session under 30 minutes', () => {
    it('earns badge when session is 29 minutes 59 seconds', () => {
      const ctx = makeCtx({ durationSeconds: 29 * 60 + 59 });
      expect(checkWildRareBadges(ctx)).toContain('ghost_protocol');
    });

    it('earns badge when session is very short (5 minutes)', () => {
      const ctx = makeCtx({ durationSeconds: 5 * 60 });
      expect(checkWildRareBadges(ctx)).toContain('ghost_protocol');
    });

    it('does not earn badge when session is exactly 30 minutes', () => {
      const ctx = makeCtx({ durationSeconds: 30 * 60 });
      expect(checkWildRareBadges(ctx)).not.toContain('ghost_protocol');
    });

    it('does not earn badge when session is over 30 minutes', () => {
      const ctx = makeCtx({ durationSeconds: 45 * 60 });
      expect(checkWildRareBadges(ctx)).not.toContain('ghost_protocol');
    });

    it('does not earn badge when duration is null', () => {
      const ctx = makeCtx({ durationSeconds: null });
      expect(checkWildRareBadges(ctx)).not.toContain('ghost_protocol');
    });

    it('does not earn badge when duration is 0', () => {
      const ctx = makeCtx({ durationSeconds: 0 });
      expect(checkWildRareBadges(ctx)).not.toContain('ghost_protocol');
    });
  });

  describe('marathon_lifter — session over 2 hours', () => {
    it('earns badge when session is 2 hours 1 second', () => {
      const ctx = makeCtx({ durationSeconds: 2 * 60 * 60 + 1 });
      expect(checkWildRareBadges(ctx)).toContain('marathon_lifter');
    });

    it('earns badge for a very long session', () => {
      const ctx = makeCtx({ durationSeconds: 3 * 60 * 60 });
      expect(checkWildRareBadges(ctx)).toContain('marathon_lifter');
    });

    it('does not earn badge when session is exactly 2 hours', () => {
      const ctx = makeCtx({ durationSeconds: 2 * 60 * 60 });
      expect(checkWildRareBadges(ctx)).not.toContain('marathon_lifter');
    });

    it('does not earn badge for a typical 90-minute session', () => {
      const ctx = makeCtx({ durationSeconds: 90 * 60 });
      expect(checkWildRareBadges(ctx)).not.toContain('marathon_lifter');
    });

    it('does not earn badge when duration is null', () => {
      const ctx = makeCtx({ durationSeconds: null });
      expect(checkWildRareBadges(ctx)).not.toContain('marathon_lifter');
    });
  });

  it('can earn both ghost_protocol and marathon_lifter only when conditions differ', () => {
    // These are mutually exclusive by definition — verify they don't co-occur
    const shortCtx = makeCtx({ durationSeconds: 20 * 60 });
    const longCtx = makeCtx({ durationSeconds: 150 * 60 });
    expect(checkWildRareBadges(shortCtx)).not.toContain('marathon_lifter');
    expect(checkWildRareBadges(longCtx)).not.toContain('ghost_protocol');
  });
});

// ── checkLiftIdentityBadges ──────────────────────────────────────────────────

describe('checkLiftIdentityBadges', () => {
  it('returns empty when any lift e1RM is 0', () => {
    const ctx = makeCtx({
      allLiftE1RMs: { squat: 150, bench: 0, deadlift: 180 },
    });
    expect(checkLiftIdentityBadges(ctx)).toEqual([]);
  });

  it('returns empty when a lift is missing entirely', () => {
    const ctx = makeCtx({
      allLiftE1RMs: { squat: 150, bench: 100 },
    });
    expect(checkLiftIdentityBadges(ctx)).toEqual([]);
  });

  describe('bench_bro — bench > squat', () => {
    it('earns badge when bench is higher than squat', () => {
      const ctx = makeCtx({
        allLiftE1RMs: { squat: 100, bench: 110, deadlift: 140 },
      });
      expect(checkLiftIdentityBadges(ctx)).toContain('bench_bro');
    });

    it('does not earn badge when bench is equal to squat', () => {
      const ctx = makeCtx({
        allLiftE1RMs: { squat: 110, bench: 110, deadlift: 140 },
      });
      expect(checkLiftIdentityBadges(ctx)).not.toContain('bench_bro');
    });

    it('does not earn badge when squat exceeds bench', () => {
      const ctx = makeCtx({
        allLiftE1RMs: { squat: 150, bench: 100, deadlift: 180 },
      });
      expect(checkLiftIdentityBadges(ctx)).not.toContain('bench_bro');
    });
  });

  describe('the_specialist — one lift 40%+ higher than the weakest', () => {
    it('earns badge when deadlift is 40% higher than bench', () => {
      // bench=100, deadlift=141 → (141−100)/100 = 0.41 ≥ 0.4
      const ctx = makeCtx({
        allLiftE1RMs: { squat: 120, bench: 100, deadlift: 141 },
      });
      expect(checkLiftIdentityBadges(ctx)).toContain('the_specialist');
    });

    it('earns badge at exactly 40% spread', () => {
      // min=100, max=140 → (140−100)/100 = 0.4
      const ctx = makeCtx({
        allLiftE1RMs: { squat: 120, bench: 100, deadlift: 140 },
      });
      expect(checkLiftIdentityBadges(ctx)).toContain('the_specialist');
    });

    it('does not earn badge when spread is below 40%', () => {
      // min=100, max=135 → (135−100)/100 = 0.35 < 0.4
      const ctx = makeCtx({
        allLiftE1RMs: { squat: 120, bench: 100, deadlift: 135 },
      });
      expect(checkLiftIdentityBadges(ctx)).not.toContain('the_specialist');
    });
  });

  describe('equal_opportunity_lifter — all lifts within 15%', () => {
    it('earns badge when all lifts are very close', () => {
      // min=100, max=110 → (110−100)/100 = 0.10 ≤ 0.15
      const ctx = makeCtx({
        allLiftE1RMs: { squat: 105, bench: 100, deadlift: 110 },
      });
      expect(checkLiftIdentityBadges(ctx)).toContain(
        'equal_opportunity_lifter'
      );
    });

    it('earns badge at exactly 15% spread', () => {
      // min=100, max=115 → (115−100)/100 = 0.15
      const ctx = makeCtx({
        allLiftE1RMs: { squat: 107, bench: 100, deadlift: 115 },
      });
      expect(checkLiftIdentityBadges(ctx)).toContain(
        'equal_opportunity_lifter'
      );
    });

    it('does not earn badge when spread exceeds 15%', () => {
      // min=100, max=120 → (120−100)/100 = 0.20 > 0.15
      const ctx = makeCtx({
        allLiftE1RMs: { squat: 110, bench: 100, deadlift: 120 },
      });
      expect(checkLiftIdentityBadges(ctx)).not.toContain(
        'equal_opportunity_lifter'
      );
    });
  });

  it('bench_bro and equal_opportunity_lifter are mutually exclusive when bench >> squat', () => {
    // High bench means large spread → cannot be equal opportunity
    const ctx = makeCtx({
      allLiftE1RMs: { squat: 80, bench: 140, deadlift: 150 },
    });
    const badges = checkLiftIdentityBadges(ctx);
    expect(badges).toContain('bench_bro');
    expect(badges).not.toContain('equal_opportunity_lifter');
  });
});

// ── checkRestPacingBadges ────────────────────────────────────────────────────

describe('checkRestPacingBadges', () => {
  it('returns empty when no sets have rest data', () => {
    const sets = Array.from({ length: 5 }, (_, i) =>
      makeActualSet({ set_number: i + 1, actual_rest_seconds: undefined })
    );
    const ctx = makeCtx({ actualSets: sets });
    expect(checkRestPacingBadges(ctx)).toEqual([]);
  });

  describe('impatient — 10+ sets with rest < 60s', () => {
    it('earns badge with exactly 10 short-rest sets', () => {
      const sets = Array.from({ length: 10 }, (_, i) =>
        makeActualSet({ set_number: i + 1, actual_rest_seconds: 45 })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkRestPacingBadges(ctx)).toContain('impatient');
    });

    it('earns badge with more than 10 short-rest sets', () => {
      const sets = Array.from({ length: 12 }, (_, i) =>
        makeActualSet({ set_number: i + 1, actual_rest_seconds: 30 })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkRestPacingBadges(ctx)).toContain('impatient');
    });

    it('does not earn badge with only 9 short-rest sets', () => {
      const sets = [
        ...Array.from({ length: 9 }, (_, i) =>
          makeActualSet({ set_number: i + 1, actual_rest_seconds: 45 })
        ),
        makeActualSet({ set_number: 10, actual_rest_seconds: 120 }),
      ];
      const ctx = makeCtx({ actualSets: sets });
      expect(checkRestPacingBadges(ctx)).not.toContain('impatient');
    });

    it('does not count sets with rest exactly 60s (not less than)', () => {
      const sets = Array.from({ length: 10 }, (_, i) =>
        makeActualSet({ set_number: i + 1, actual_rest_seconds: 60 })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkRestPacingBadges(ctx)).not.toContain('impatient');
    });
  });

  describe('social_hour — average rest > 5 minutes', () => {
    it('earns badge when average rest is 301 seconds', () => {
      const sets = Array.from({ length: 3 }, (_, i) =>
        makeActualSet({ set_number: i + 1, actual_rest_seconds: 301 })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkRestPacingBadges(ctx)).toContain('social_hour');
    });

    it('earns badge with mixed long rests averaging over 300s', () => {
      const sets = [
        makeActualSet({ set_number: 1, actual_rest_seconds: 200 }),
        makeActualSet({ set_number: 2, actual_rest_seconds: 400 }),
        makeActualSet({ set_number: 3, actual_rest_seconds: 400 }),
      ];
      // avg = 1000/3 ≈ 333s > 300s
      const ctx = makeCtx({ actualSets: sets });
      expect(checkRestPacingBadges(ctx)).toContain('social_hour');
    });

    it('does not earn badge when average rest is exactly 300 seconds', () => {
      const sets = Array.from({ length: 3 }, (_, i) =>
        makeActualSet({ set_number: i + 1, actual_rest_seconds: 300 })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkRestPacingBadges(ctx)).not.toContain('social_hour');
    });

    it('does not earn badge with typical 2-minute rest periods', () => {
      const sets = Array.from({ length: 5 }, (_, i) =>
        makeActualSet({ set_number: i + 1, actual_rest_seconds: 120 })
      );
      const ctx = makeCtx({ actualSets: sets });
      expect(checkRestPacingBadges(ctx)).not.toContain('social_hour');
    });
  });
});

// ── checkConsistencyBadges ───────────────────────────────────────────────────

describe('checkConsistencyBadges', () => {
  describe('dawn_patrol — 5+ sessions before 6am', () => {
    it('earns badge at exactly 5 pre-dawn sessions', () => {
      const data = makeConsistencyData({ sessionsBeforeSixAm: 5 });
      expect(checkConsistencyBadges(data)).toContain('dawn_patrol');
    });

    it('does not earn badge with 4 pre-dawn sessions', () => {
      const data = makeConsistencyData({ sessionsBeforeSixAm: 4 });
      expect(checkConsistencyBadges(data)).not.toContain('dawn_patrol');
    });
  });

  describe('night_owl — 5+ sessions after 9pm', () => {
    it('earns badge at exactly 5 late-night sessions', () => {
      const data = makeConsistencyData({ sessionsAfterNinePm: 5 });
      expect(checkConsistencyBadges(data)).toContain('night_owl');
    });

    it('does not earn badge with 4 late-night sessions', () => {
      const data = makeConsistencyData({ sessionsAfterNinePm: 4 });
      expect(checkConsistencyBadges(data)).not.toContain('night_owl');
    });
  });

  describe('iron_monk — 30 consecutive perfect-set sessions', () => {
    it('earns badge at exactly 30 consecutive perfect sessions', () => {
      const data = makeConsistencyData({ consecutivePerfectSessions: 30 });
      expect(checkConsistencyBadges(data)).toContain('iron_monk');
    });

    it('earns badge above 30', () => {
      const data = makeConsistencyData({ consecutivePerfectSessions: 45 });
      expect(checkConsistencyBadges(data)).toContain('iron_monk');
    });

    it('does not earn badge at 29', () => {
      const data = makeConsistencyData({ consecutivePerfectSessions: 29 });
      expect(checkConsistencyBadges(data)).not.toContain('iron_monk');
    });
  });

  describe('sunday_scaries_cure — 10+ Sunday sessions', () => {
    it('earns badge at exactly 10 Sunday sessions', () => {
      const data = makeConsistencyData({ distinctSundaySessions: 10 });
      expect(checkConsistencyBadges(data)).toContain('sunday_scaries_cure');
    });

    it('does not earn badge at 9 Sunday sessions', () => {
      const data = makeConsistencyData({ distinctSundaySessions: 9 });
      expect(checkConsistencyBadges(data)).not.toContain('sunday_scaries_cure');
    });
  });

  describe('year_365 — 52+ week streak', () => {
    it('earns badge at exactly 52 weeks', () => {
      const data = makeConsistencyData({ streakWeeks: 52 });
      expect(checkConsistencyBadges(data)).toContain('year_365');
    });

    it('earns badge above 52 weeks', () => {
      const data = makeConsistencyData({ streakWeeks: 104 });
      expect(checkConsistencyBadges(data)).toContain('year_365');
    });

    it('does not earn badge at 51 weeks', () => {
      const data = makeConsistencyData({ streakWeeks: 51 });
      expect(checkConsistencyBadges(data)).not.toContain('year_365');
    });
  });

  describe('perfect_week — all planned sessions completed this week', () => {
    it('earns badge when isPerfectWeek is true', () => {
      const data = makeConsistencyData({ isPerfectWeek: true });
      expect(checkConsistencyBadges(data)).toContain('perfect_week');
    });

    it('does not earn badge when isPerfectWeek is false', () => {
      const data = makeConsistencyData({ isPerfectWeek: false });
      expect(checkConsistencyBadges(data)).not.toContain('perfect_week');
    });
  });

  describe('leg_day_loyalist — 20 consecutive leg-day sessions', () => {
    it('earns badge at exactly 20 consecutive leg days', () => {
      const data = makeConsistencyData({ consecutiveLegDaySessions: 20 });
      expect(checkConsistencyBadges(data)).toContain('leg_day_loyalist');
    });

    it('does not earn badge at 19 consecutive leg days', () => {
      const data = makeConsistencyData({ consecutiveLegDaySessions: 19 });
      expect(checkConsistencyBadges(data)).not.toContain('leg_day_loyalist');
    });
  });

  it('returns empty array when all values are at zero/false', () => {
    const data = makeConsistencyData();
    expect(checkConsistencyBadges(data)).toEqual([]);
  });

  it('can earn multiple consistency badges simultaneously', () => {
    const data = makeConsistencyData({
      sessionsBeforeSixAm: 10,
      isPerfectWeek: true,
      streakWeeks: 52,
    });
    const badges = checkConsistencyBadges(data);
    expect(badges).toContain('dawn_patrol');
    expect(badges).toContain('perfect_week');
    expect(badges).toContain('year_365');
  });
});

// ── checkProgramLoyaltyBadges ────────────────────────────────────────────────

describe('checkProgramLoyaltyBadges', () => {
  describe('old_faithful — same formula for 3+ consecutive cycles', () => {
    it('earns badge at exactly 3 consecutive same-formula cycles', () => {
      const data = makeProgramLoyaltyData({ consecutiveSameFormulaCycles: 3 });
      expect(checkProgramLoyaltyBadges(data)).toContain('old_faithful');
    });

    it('earns badge above 3 cycles', () => {
      const data = makeProgramLoyaltyData({ consecutiveSameFormulaCycles: 8 });
      expect(checkProgramLoyaltyBadges(data)).toContain('old_faithful');
    });

    it('does not earn badge at 2 consecutive cycles', () => {
      const data = makeProgramLoyaltyData({ consecutiveSameFormulaCycles: 2 });
      expect(checkProgramLoyaltyBadges(data)).not.toContain('old_faithful');
    });
  });

  describe('shiny_object_syndrome — 3+ formula changes in one cycle', () => {
    it('earns badge with exactly 3 formula changes', () => {
      const data = makeProgramLoyaltyData({ formulaChangesThisCycle: 3 });
      expect(checkProgramLoyaltyBadges(data)).toContain(
        'shiny_object_syndrome'
      );
    });

    it('earns badge with more than 3 formula changes', () => {
      const data = makeProgramLoyaltyData({ formulaChangesThisCycle: 5 });
      expect(checkProgramLoyaltyBadges(data)).toContain(
        'shiny_object_syndrome'
      );
    });

    it('does not earn badge with 2 formula changes', () => {
      const data = makeProgramLoyaltyData({ formulaChangesThisCycle: 2 });
      expect(checkProgramLoyaltyBadges(data)).not.toContain(
        'shiny_object_syndrome'
      );
    });
  });

  describe('deload_denier — 3 consecutive cycles without deload', () => {
    it('earns badge at exactly 3 cycles without deload', () => {
      const data = makeProgramLoyaltyData({
        consecutiveCyclesWithoutDeload: 3,
      });
      expect(checkProgramLoyaltyBadges(data)).toContain('deload_denier');
    });

    it('earns badge above 3 cycles without deload', () => {
      const data = makeProgramLoyaltyData({
        consecutiveCyclesWithoutDeload: 6,
      });
      expect(checkProgramLoyaltyBadges(data)).toContain('deload_denier');
    });

    it('does not earn badge at 2 cycles without deload', () => {
      const data = makeProgramLoyaltyData({
        consecutiveCyclesWithoutDeload: 2,
      });
      expect(checkProgramLoyaltyBadges(data)).not.toContain('deload_denier');
    });
  });

  it('returns empty array when all values are zero', () => {
    const data = makeProgramLoyaltyData();
    expect(checkProgramLoyaltyBadges(data)).toEqual([]);
  });

  it('can earn old_faithful and shiny_object_syndrome are mutually exclusive conceptually but not enforced', () => {
    // The checker does not prevent both — verify both fire if data says so
    const data = makeProgramLoyaltyData({
      consecutiveSameFormulaCycles: 3,
      formulaChangesThisCycle: 3,
    });
    const badges = checkProgramLoyaltyBadges(data);
    expect(badges).toContain('old_faithful');
    expect(badges).toContain('shiny_object_syndrome');
  });
});

// ── Volume Goblin (situational) ─────────────────────────────────────────────

describe('volume_goblin — 5+ non-1RM PRs with zero 1RM PRs', () => {
  it('earns badge with 5 volume PRs and 0 1RM PRs', () => {
    const ctx = makeCtx({ volumePrCount: 5, oneRmPrCount: 0 });
    expect(checkSituationalBadges(ctx)).toContain('volume_goblin');
  });

  it('does not earn badge when 1RM PRs exist', () => {
    const ctx = makeCtx({ volumePrCount: 5, oneRmPrCount: 1 });
    expect(checkSituationalBadges(ctx)).not.toContain('volume_goblin');
  });

  it('does not earn badge with only 4 volume PRs', () => {
    const ctx = makeCtx({ volumePrCount: 4, oneRmPrCount: 0 });
    expect(checkSituationalBadges(ctx)).not.toContain('volume_goblin');
  });
});

// ── Jack of All Lifts (volume-rep) ──────────────────────────────────────────

describe('jack_of_all_lifts — 10+ unique aux exercises in cycle', () => {
  it('earns badge at exactly 10 unique aux exercises', () => {
    const ctx = makeCtx({ uniqueAuxExercisesInCycle: 10 });
    expect(checkVolumeRepBadges(ctx)).toContain('jack_of_all_lifts');
  });

  it('does not earn badge with 9 unique aux exercises', () => {
    const ctx = makeCtx({ uniqueAuxExercisesInCycle: 9 });
    expect(checkVolumeRepBadges(ctx)).not.toContain('jack_of_all_lifts');
  });
});

// ── Zen Master (rest-pacing) ────────────────────────────────────────────────

describe('zen_master — 5 consecutive full-rest sessions', () => {
  it('earns badge at exactly 5 consecutive full-rest sessions', () => {
    const ctx = makeCtx({ consecutiveFullRestSessions: 5 });
    expect(checkRestPacingBadges(ctx)).toContain('zen_master');
  });

  it('does not earn badge with 4 consecutive full-rest sessions', () => {
    const ctx = makeCtx({ consecutiveFullRestSessions: 4 });
    expect(checkRestPacingBadges(ctx)).not.toContain('zen_master');
  });
});

// ── Streak Breaker (wild-rare) ──────────────────────────────────────────────

describe('the_streak_breaker — broke 8+ streak then rebuilt to 8+', () => {
  it('earns badge when hadStreakBreakAndRebuild is true', () => {
    const ctx = makeCtx({ hadStreakBreakAndRebuild: true });
    expect(checkWildRareBadges(ctx)).toContain('the_streak_breaker');
  });

  it('does not earn badge when hadStreakBreakAndRebuild is false', () => {
    const ctx = makeCtx({ hadStreakBreakAndRebuild: false });
    expect(checkWildRareBadges(ctx)).not.toContain('the_streak_breaker');
  });
});

function makeWeek(overrides: Partial<WeekStatus> = {}): WeekStatus {
  return {
    weekStartDate: '2025-01-06',
    scheduled: 3,
    completed: 3,
    skippedWithDisruption: 0,
    unaccountedMisses: 0,
    ...overrides,
  };
}

describe('detectStreakBreakAndRebuild', () => {
  it('returns true when 8-week streak broken then rebuilt to 8+', () => {
    const weeks: WeekStatus[] = [
      // 8 clean weeks
      ...Array.from({ length: 8 }, () => makeWeek()),
      // break
      makeWeek({ unaccountedMisses: 1 }),
      // 8 more clean weeks
      ...Array.from({ length: 8 }, () => makeWeek()),
    ];
    expect(detectStreakBreakAndRebuild(weeks)).toBe(true);
  });

  it('returns false when streak never reached 8 weeks', () => {
    const weeks: WeekStatus[] = [
      ...Array.from({ length: 7 }, () => makeWeek()),
      makeWeek({ unaccountedMisses: 1 }),
      ...Array.from({ length: 10 }, () => makeWeek()),
    ];
    expect(detectStreakBreakAndRebuild(weeks)).toBe(false);
  });

  it('returns false when rebuild is only 7 weeks', () => {
    const weeks: WeekStatus[] = [
      ...Array.from({ length: 8 }, () => makeWeek()),
      makeWeek({ unaccountedMisses: 1 }),
      ...Array.from({ length: 7 }, () => makeWeek()),
    ];
    expect(detectStreakBreakAndRebuild(weeks)).toBe(false);
  });

  it('returns false with empty history', () => {
    expect(detectStreakBreakAndRebuild([])).toBe(false);
  });
});

// ── Couples Badges ─────────────────────────────────────────────────────────

describe('checkCouplesBadges', () => {
  it('awards power_couple when partner completed today', () => {
    const ctx = makeCtx({ partnerCompletedToday: true });
    expect(checkCouplesBadges(ctx)).toContain('power_couple');
  });

  it('does not award power_couple when no partner completed today', () => {
    const ctx = makeCtx({ partnerCompletedToday: false });
    expect(checkCouplesBadges(ctx)).not.toContain('power_couple');
  });
});
