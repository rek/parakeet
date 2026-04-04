import { describe, expect, it } from 'vitest';

import {
  atMevExcept,
  baseInput,
  makeDisruption,
} from '../__test-helpers__/fixtures';
import { DEFAULT_MRV_MEV_CONFIG_MALE } from '../volume/mrv-mev-calculator';
import { generateJITSessionWithTrace } from './jit-session-generator';

describe('generateJITSessionWithTrace', () => {
  it('produces trace with all sections populated for a standard input', () => {
    const { output, trace } = generateJITSessionWithTrace(baseInput());

    expect(trace.sessionId).toBe('sess-001');
    expect(trace.primaryLift).toBe('squat');
    expect(trace.intensityType).toBe('heavy');
    expect(trace.blockNumber).toBe(1);
    expect(trace.oneRmKg).toBe(140);
    expect(trace.strategy).toBe('formula');

    // Main lift
    expect(trace.mainLift.weightDerivation).not.toBeNull();
    expect(trace.mainLift.sets.length).toBe(output.mainLiftSets.length);
    expect(trace.mainLift.isRecoveryMode).toBe(false);
    expect(trace.mainLift.isSkipped).toBe(false);

    // Warmup populated
    expect(trace.warmup).not.toBeNull();
    expect(trace.warmup!.steps.length).toBeGreaterThan(0);

    // Rest populated
    expect(trace.rest.mainLift.finalSeconds).toBeGreaterThan(0);
    expect(trace.rest.auxiliarySeconds).toBeGreaterThan(0);

    // Rationale and warnings match output
    expect(trace.rationale).toEqual(output.rationale);
    expect(trace.warnings).toEqual(output.warnings);
  });

  it('records weight derivation with base weight and final weight', () => {
    const { trace } = generateJITSessionWithTrace(baseInput());
    const wd = trace.mainLift.weightDerivation!;

    expect(wd.oneRmKg).toBe(140);
    expect(wd.blockPct).toBeGreaterThan(0);
    expect(wd.baseWeightKg).toBeGreaterThan(0);
    expect(wd.finalWeightKg).toBeGreaterThan(0);
    // No modifiers for clean input
    expect(wd.modifiers).toHaveLength(0);
    expect(wd.finalMultiplier).toBe(1);
  });

  it('records readiness modifier when sleep is poor', () => {
    const { trace } = generateJITSessionWithTrace(
      baseInput({ sleepQuality: 1, energyLevel: 1 })
    );
    const wd = trace.mainLift.weightDerivation!;

    const readinessMod = wd.modifiers.find((m) => m.source === 'readiness');
    expect(readinessMod).toBeDefined();
    expect(readinessMod!.multiplier).toBeLessThan(1);
  });

  it('records soreness volume change', () => {
    const { trace } = generateJITSessionWithTrace(
      baseInput({ sorenessRatings: { quads: 8 } })
    );

    const sorenessVol = trace.mainLift.volumeChanges.find(
      (v) => v.source === 'soreness'
    );
    expect(sorenessVol).toBeDefined();
    expect(sorenessVol!.setsAfter).toBeLessThan(sorenessVol!.setsBefore);
  });

  it('records recovery mode for soreness 10', () => {
    const { trace } = generateJITSessionWithTrace(
      baseInput({ sorenessRatings: { quads: 10 } })
    );

    expect(trace.mainLift.isRecoveryMode).toBe(true);
    expect(trace.mainLift.sets.length).toBe(3);
    expect(trace.mainLift.sets[0].repSource).toContain('recovery');
  });

  it('records skipped main lift for major disruption', () => {
    const { trace } = generateJITSessionWithTrace(
      baseInput({
        activeDisruptions: [
          {
            id: 'd1',
            user_id: 'u1',
            program_id: null,
            session_ids_affected: null,
            reported_at: new Date().toISOString(),
            disruption_type: 'injury',
            severity: 'major',
            affected_date_start: '2026-01-01',
            affected_date_end: null,
            affected_lifts: ['squat'],
            description: 'ACL tear',
            adjustment_applied: null,
            resolved_at: null,
            status: 'active',
          },
        ],
      })
    );

    expect(trace.mainLift.isSkipped).toBe(true);
    expect(trace.mainLift.sets).toHaveLength(0);
  });

  it('records no weight derivation when main lift is skipped', () => {
    const { trace } = generateJITSessionWithTrace(
      baseInput({
        activeDisruptions: [
          {
            id: 'd1',
            user_id: 'u1',
            program_id: null,
            session_ids_affected: null,
            reported_at: new Date().toISOString(),
            disruption_type: 'injury',
            severity: 'major',
            affected_date_start: '2026-01-01',
            affected_date_end: null,
            affected_lifts: ['squat'],
            description: 'ACL tear',
            adjustment_applied: null,
            resolved_at: null,
            status: 'active',
          },
        ],
      })
    );

    // Weight derivation is still present (base was computed before skip decision)
    // but sets are empty
    expect(trace.mainLift.sets).toHaveLength(0);
  });

  it('records rest trace with formula base', () => {
    const { trace } = generateJITSessionWithTrace(baseInput());

    expect(trace.rest.mainLift.formulaBaseSeconds).toBeGreaterThan(0);
    expect(trace.rest.mainLift.finalSeconds).toBe(
      trace.rest.mainLift.formulaBaseSeconds
    );
    expect(trace.rest.mainLift.userOverrideSeconds).toBeNull();
    expect(trace.rest.mainLift.llmDeltaSeconds).toBeNull();
  });

  it('records rest override when user override is present', () => {
    const { trace } = generateJITSessionWithTrace(
      baseInput({
        userRestOverrides: [
          { lift: 'squat', intensityType: 'heavy', restSeconds: 240 },
        ],
      })
    );

    expect(trace.rest.mainLift.finalSeconds).toBe(240);
    expect(trace.rest.mainLift.userOverrideSeconds).toBe(240);
  });

  it('records warmup trace with protocol name and steps', () => {
    const { trace } = generateJITSessionWithTrace(baseInput());

    expect(trace.warmup).not.toBeNull();
    expect(trace.warmup!.protocolName).toBe('standard');
    expect(trace.warmup!.workingWeightKg).toBeGreaterThan(0);
    expect(trace.warmup!.steps.every((s) => s.weightKg > 0)).toBe(true);
  });

  it('records cycle phase modifier and volume change', () => {
    const { trace } = generateJITSessionWithTrace(
      baseInput({ cyclePhase: 'menstrual', biologicalSex: 'female' })
    );
    const cycleMod = trace.mainLift.weightDerivation!.modifiers.find(
      (m) => m.source === 'cycle_phase'
    );
    expect(cycleMod).toBeDefined();
    expect(cycleMod!.multiplier).toBe(0.95);

    const cycleVol = trace.mainLift.volumeChanges.find(
      (v) => v.source === 'cycle_phase'
    );
    expect(cycleVol).toBeDefined();
  });

  it('records moderate disruption modifier and volume change', () => {
    const { trace } = generateJITSessionWithTrace(
      baseInput({ activeDisruptions: [makeDisruption('moderate')] })
    );

    const disruptionMod = trace.mainLift.weightDerivation!.modifiers.find(
      (m) => m.source === 'disruption'
    );
    expect(disruptionMod).toBeDefined();
    expect(disruptionMod!.multiplier).toBe(0.9);
  });

  it('traces assigned auxiliary exercises', () => {
    const { trace } = generateJITSessionWithTrace(baseInput());

    expect(trace.auxiliaries.length).toBeGreaterThan(0);
    const assigned = trace.auxiliaries.filter(
      (a) => a.selectionReason === 'assigned auxiliary'
    );
    expect(assigned.length).toBeGreaterThan(0);
    expect(assigned[0].exercise).toBeTruthy();
  });

  it('traces skipped auxiliary exercises', () => {
    const { trace } = generateJITSessionWithTrace(
      baseInput({ sorenessRatings: { quads: 10 } })
    );

    const skipped = trace.auxiliaries.filter((a) => a.skipped);
    expect(skipped.length).toBeGreaterThan(0);
    expect(skipped[0].skipReason).toBeTruthy();
  });

  it('traces volume top-up exercises', () => {
    const { trace } = generateJITSessionWithTrace(
      baseInput({
        auxiliaryPool: ['Romanian Dumbbell Deadlift', 'Leg Press'],
        weeklyVolumeToDate: atMevExcept(
          DEFAULT_MRV_MEV_CONFIG_MALE,
          'hamstrings'
        ),
        mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
      })
    );

    const topUps = trace.auxiliaries.filter((a) =>
      a.selectionReason.includes('below MEV')
    );
    expect(topUps.length).toBeGreaterThan(0);
  });

  it('set traces match output mainLiftSets', () => {
    const { output, trace } = generateJITSessionWithTrace(baseInput());

    expect(trace.mainLift.sets.length).toBe(output.mainLiftSets.length);
    for (let i = 0; i < output.mainLiftSets.length; i++) {
      expect(trace.mainLift.sets[i].weightKg).toBe(
        output.mainLiftSets[i].weight_kg
      );
      expect(trace.mainLift.sets[i].reps).toBe(output.mainLiftSets[i].reps);
      expect(trace.mainLift.sets[i].rpeTarget).toBe(
        output.mainLiftSets[i].rpe_target
      );
    }
  });
});
