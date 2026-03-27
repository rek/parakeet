import {
  atMevExcept,
  baseInput,
  makeDisruption,
} from '../__test-helpers__/fixtures';
import {
  DEFAULT_FORMULA_CONFIG_FEMALE,
  DEFAULT_FORMULA_CONFIG_MALE,
} from '../cube/blocks';
import {
  DEFAULT_MRV_MEV_CONFIG_FEMALE,
  DEFAULT_MRV_MEV_CONFIG_MALE,
} from '../volume/mrv-mev-calculator';
import { generateJITSession } from './jit-session-generator';

describe('JIT scenarios — real training days', () => {
  it('beginner female, menstrual phase, first heavy squat of the week', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'squat',
        intensityType: 'heavy',
        blockNumber: 1,
        oneRmKg: 60,
        biologicalSex: 'female',
        formulaConfig: DEFAULT_FORMULA_CONFIG_FEMALE,
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_FEMALE,
        cyclePhase: 'menstrual',
      })
    );
    // Menstrual phase: -1 set from female base (3), ×0.95 intensity
    expect(out.mainLiftSets.length).toBe(2);
    // Weight should be reasonable for a 60kg squatter
    expect(out.mainLiftSets[0].weight_kg).toBeGreaterThan(30);
    expect(out.mainLiftSets[0].weight_kg).toBeLessThan(60);
    // Rationale should mention the cycle phase
    expect(out.rationale.some((r) => /menstrual|cycle/i.test(r))).toBe(true);
    // Warmups should exist and be lighter than working weight
    expect(out.warmupSets.length).toBeGreaterThan(0);
    expect(out.warmupSets[0].weightKg).toBeLessThan(
      out.mainLiftSets[0].weight_kg
    );
  });

  it('advanced male, block 3 heavy, moderate quad soreness', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'squat',
        intensityType: 'heavy',
        blockNumber: 3,
        oneRmKg: 200,
        biologicalSex: 'male',
        sorenessRatings: { quads: 8 },
      })
    );
    // Male soreness 8: -2 sets, ×0.95
    // Block 3 heavy male = 4 sets at 90% → 4-2 = 2 sets
    expect(out.mainLiftSets.length).toBe(2);
    // Weight: 200 × 0.90 = 180 → rounded to 180 × 0.95 = 171 → rounds to 170
    expect(out.mainLiftSets[0].weight_kg).toBe(170);
  });

  it('female returning from illness, poor sleep, luteal phase', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'bench',
        intensityType: 'rep',
        blockNumber: 2,
        oneRmKg: 50,
        biologicalSex: 'female',
        formulaConfig: DEFAULT_FORMULA_CONFIG_FEMALE,
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_FEMALE,
        sleepQuality: 1,
        energyLevel: 2,
        cyclePhase: 'luteal',
        activeDisruptions: [
          {
            ...makeDisruption('moderate', 'bench'),
            disruption_type: 'illness',
            description: 'Recovering from flu',
          },
        ],
      })
    );
    // Multiple adjustments should stack — output should be conservative
    expect(out.mainLiftSets.length).toBeGreaterThanOrEqual(1);
    // Weight should be well below base (50 × 0.8 = 40)
    expect(out.mainLiftSets[0].weight_kg).toBeLessThanOrEqual(50 * 0.7);
    // Multiple rationale entries explaining each adjustment
    expect(out.rationale.length).toBeGreaterThanOrEqual(2);
  });

  it('deload week with all signals neutral', () => {
    const out = generateJITSession(
      baseInput({
        intensityType: 'deload',
        blockNumber: 1,
        oneRmKg: 140,
      })
    );
    // Deload: light weight, low RPE
    expect(out.mainLiftSets.length).toBeGreaterThanOrEqual(1);
    for (const s of out.mainLiftSets) {
      // Deload weight should be well below working weight
      expect(s.weight_kg).toBeLessThan(140 * 0.6);
      expect(s.rpe_target).toBeLessThanOrEqual(6);
    }
  });

  it('the Hyrox scenario — disruption + high soreness compound conservatively', () => {
    // Friday: deadlift (completed fine)
    // Sunday: Hyrox race (logged as disruption)
    // Monday: squat session with high soreness from Hyrox
    const out = generateJITSession(
      baseInput({
        primaryLift: 'squat',
        intensityType: 'heavy',
        oneRmKg: 170,
        sorenessRatings: { quads: 8, glutes: 6, lower_back: 6 },
        activeDisruptions: [
          {
            ...makeDisruption('moderate'),
            disruption_type: 'other',
            description: 'Hyrox race on Sunday',
            affected_lifts: null,
          },
        ],
        // Last squat session was fine (RPE at target)
        recentLogs: [
          { actual_rpe: 8.5, target_rpe: 8.5 },
          { actual_rpe: 8.0, target_rpe: 8.5 },
        ],
      })
    );
    // System should reduce conservatively — both soreness and disruption contribute
    expect(out.mainLiftSets.length).toBeGreaterThanOrEqual(1);
    // Weight should be reduced from base (170 × 0.80 = 136, rounded to 135)
    expect(out.mainLiftSets[0].weight_kg).toBeLessThan(136);
    // Rationale should mention both disruption and soreness
    expect(out.rationale.some((r) => /hyrox/i.test(r))).toBe(true);
    expect(out.rationale.some((r) => /soreness/i.test(r))).toBe(true);
    // No more than 1 set (both adjusters reduce heavily)
    expect(out.mainLiftSets.length).toBeLessThanOrEqual(1);
  });

  it('volume top-up on deadlift day targets push muscles via bench 1RM', () => {
    const out = generateJITSession(
      baseInput({
        primaryLift: 'deadlift',
        intensityType: 'heavy',
        oneRmKg: 200,
        // All muscles at MEV except chest (push muscle undertrained)
        weeklyVolumeToDate: atMevExcept(DEFAULT_MRV_MEV_CONFIG_MALE, 'chest'),
        auxiliaryPool: ['Dumbbell Fly', 'Dips', 'Stiff-Leg Deadlift'],
        allOneRmKg: { squat: 160, bench: 100, deadlift: 200 },
        // Last session of the week so pro-rated MEV threshold is full
        sessionIndex: 3,
        totalSessionsThisWeek: 3,
      })
    );
    // Should have at least one top-up exercise targeting chest
    const topUps = out.auxiliaryWork.filter((a) => a.isTopUp);
    expect(topUps.length).toBeGreaterThanOrEqual(1);
    // Top-up should mention the reason
    expect(topUps[0].topUpReason).toBeTruthy();
  });
});
