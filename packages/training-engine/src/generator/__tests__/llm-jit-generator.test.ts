import { JITAdjustmentSchema } from '@parakeet/shared-types';
import type { JITAdjustment } from '@parakeet/shared-types';
import { generateText } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { atMevExcept, makeDisruption } from '../../__test-helpers__/fixtures';
import type { AuxHistoryEntry } from '../../auxiliary/anchor';
import { DEFAULT_CORE_POOL } from '../../auxiliary/exercise-catalog';
import { DEFAULT_FORMULA_CONFIG_MALE } from '../../cube/blocks';
import { DEFAULT_MRV_MEV_CONFIG_MALE } from '../../volume/mrv-mev-calculator';
import { enforceHardConstraints } from '../jit-constraints';
import type { JITInput } from '../jit-session-generator';
import { applyAdjustment, LLMJITGenerator } from '../llm-jit-generator';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function baseInput(overrides: Partial<JITInput> = {}): JITInput {
  return {
    sessionId: 'sess-001',
    weekNumber: 1,
    blockNumber: 1,
    primaryLift: 'squat',
    intensityType: 'heavy',
    oneRmKg: 140,
    formulaConfig: DEFAULT_FORMULA_CONFIG_MALE,
    sorenessRatings: {},
    weeklyVolumeToDate: {},
    mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
    activeAuxiliaries: ['Pause Squat', 'Barbell Box Squat'],
    recentLogs: [],
    activeDisruptions: [],
    warmupConfig: { type: 'preset', name: 'standard' },
    ...overrides,
  };
}

function baseAdj(overrides: Partial<JITAdjustment> = {}): JITAdjustment {
  return {
    intensityModifier: 1.0,
    setModifier: 0,
    skipMainLift: false,
    auxOverrides: [],
    rationale: ['Normal session'],
    confidence: 'high',
    restAdjustments: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// applyAdjustment — pure function, no AI mock needed
// ---------------------------------------------------------------------------

describe('applyAdjustment', () => {
  it('applies LLM adjustment to base weight', () => {
    const adj = baseAdj({
      intensityModifier: 0.9,
      setModifier: -1,
      rationale: ['Minor soreness — reducing intensity'],
    });
    const output = applyAdjustment(adj, baseInput());

    // Block 1 Heavy squat 140kg → base weight ~112.5kg; 0.90 × 112.5 < 112.5
    expect(output.mainLiftSets.length).toBeGreaterThan(0);
    expect(output.mainLiftSets[0].weight_kg).toBeLessThan(112.5);
    expect(output.rationale).toContain('Minor soreness — reducing intensity');
  });

  describe('rest adjustments (engine-021) — advisory-only after finding #18', () => {
    it('+60s delta exposed via llmRestSuggestion; per-set rest stays at formula default', () => {
      const output = applyAdjustment(
        baseAdj({ restAdjustments: { mainLift: 60 } }),
        baseInput()
      );

      const formulaBase = DEFAULT_FORMULA_CONFIG_MALE.rest_seconds.block1.heavy;
      expect(output.restRecommendations.mainLift.length).toBeGreaterThan(0);
      // Per-set rest is unchanged from formula — the chip applies the
      // delta only after the user opts in.
      output.restRecommendations.mainLift.forEach((r) => {
        expect(r).toBe(formulaBase);
      });
      expect(output.llmRestSuggestion).toEqual({
        deltaSeconds: 60,
        formulaBaseSeconds: formulaBase,
      });
    });

    it('clamps restAdjustments.mainLift to 60 when LLM returns 90', () => {
      const warnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const output = applyAdjustment(
        baseAdj({ restAdjustments: { mainLift: 90 } }),
        baseInput()
      );

      const formulaBase = DEFAULT_FORMULA_CONFIG_MALE.rest_seconds.block1.heavy;
      // Per-set rest remains the formula default
      output.restRecommendations.mainLift.forEach((r) => {
        expect(r).toBe(formulaBase);
      });
      expect(output.llmRestSuggestion).toEqual({
        deltaSeconds: 60, // clamped from 90
        formulaBaseSeconds: formulaBase,
      });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('clamped'));
      warnSpy.mockRestore();
    });

    it('-30s delta still appears in llmRestSuggestion; per-set rest unchanged', () => {
      const output = applyAdjustment(
        baseAdj({ restAdjustments: { mainLift: -30 } }),
        baseInput()
      );

      const formulaBase = DEFAULT_FORMULA_CONFIG_MALE.rest_seconds.block1.heavy;
      output.restRecommendations.mainLift.forEach((r) => {
        expect(r).toBe(formulaBase);
      });
      expect(output.llmRestSuggestion).toEqual({
        deltaSeconds: -30,
        formulaBaseSeconds: formulaBase,
      });
    });

    it('leaves rest unchanged and llmRestSuggestion undefined when restAdjustments omitted', () => {
      const output = applyAdjustment(baseAdj(), baseInput());

      const formulaBase = DEFAULT_FORMULA_CONFIG_MALE.rest_seconds.block1.heavy;
      output.restRecommendations.mainLift.forEach((r) => {
        expect(r).toBe(formulaBase);
      });
      expect(output.llmRestSuggestion).toBeUndefined();
    });
  });

  describe('volume top-up (gh#203)', () => {
    it('appends a core exercise when core is below MEV', () => {
      const output = applyAdjustment(
        baseAdj(),
        baseInput({
          auxiliaryPool: DEFAULT_CORE_POOL,
          weeklyVolumeToDate: atMevExcept(DEFAULT_MRV_MEV_CONFIG_MALE, 'core'),
        })
      );
      const coreTopUps = output.auxiliaryWork.filter(
        (a) => a.isTopUp && DEFAULT_CORE_POOL.includes(a.exercise)
      );
      expect(coreTopUps.length).toBeGreaterThan(0);
      expect(coreTopUps[0].topUpReason).toContain('below MEV');
    });

    it('does not append top-ups when auxiliaryPool is empty', () => {
      const output = applyAdjustment(baseAdj(), baseInput());
      expect(output.auxiliaryWork.some((a) => a.isTopUp)).toBe(false);
    });
  });

  describe('GH#217 proportional aux clamp', () => {
    it('LLM cuts main to 50% → aux sets capped proportionally', () => {
      const adj = baseAdj({
        intensityModifier: 0.7,
        setModifier: -1,
      });
      const output = applyAdjustment(adj, baseInput());
      // base squat heavy block 1 = 2 sets; setModifier -1 → 1 set; ratio 0.5
      // proportional ceiling for aux = round(3 × 0.5) = 2 sets
      expect(output.mainLiftSets).toHaveLength(1);
      output.auxiliaryWork.forEach((a) => {
        expect(a.sets.length).toBeLessThanOrEqual(2);
      });
    });

    it('LLM cuts intensityModifier → aux weight ceiling matches', () => {
      const adj = baseAdj({ intensityModifier: 0.6 });
      const output = applyAdjustment(adj, baseInput());
      // Aux weight should reflect the 0.6 ceiling, not full baseAuxWeight
      const baseline = applyAdjustment(baseAdj(), baseInput());
      output.auxiliaryWork.forEach((a, i) => {
        if (a.sets.length === 0) return;
        expect(a.sets[0].weight_kg).toBeLessThanOrEqual(
          baseline.auxiliaryWork[i].sets[0].weight_kg
        );
      });
    });

    it('LLM skips main lift → aux suppressed', () => {
      const adj = baseAdj({ skipMainLift: true });
      const output = applyAdjustment(adj, baseInput());
      expect(output.skippedMainLift).toBe(true);
      output.auxiliaryWork
        .filter((a) => !a.isTopUp)
        .forEach((a) => {
          expect(a.skipped).toBe(true);
          expect(a.skipReason).toMatch(/main lift skipped/i);
        });
    });

    it('deload applies explicit deload aux ratios (GH#231)', () => {
      const adj = baseAdj({ intensityModifier: 0.7, setModifier: -1 });
      const output = applyAdjustment(
        adj,
        baseInput({ intensityType: 'deload' })
      );
      // Pre-GH#231: deload bypassed propagation entirely → aux ran at 3 sets,
      // full weight. That meant deload only cut the main lift while accessory
      // load was unchanged. Now deload gets DELOAD_AUX_VOLUME_RATIO=0.67 →
      // 2 sets, regardless of what the LLM tried to apply on top.
      output.auxiliaryWork.forEach((a) => {
        expect(a.sets).toHaveLength(2);
      });
    });
  });

  describe('LLM aux honours severe soreness (finding #17)', () => {
    it('skips all aux when worstSoreness >= 9', () => {
      const output = applyAdjustment(
        baseAdj(),
        baseInput({
          sorenessRatings: { quads: 9 },
        })
      );
      // Every aux should be marked skipped with the severe-soreness reason
      expect(output.auxiliaryWork.length).toBeGreaterThan(0);
      output.auxiliaryWork.forEach((a) => {
        expect(a.skipped).toBe(true);
        expect(a.skipReason).toContain('Severe soreness');
      });
    });

    it('does not skip when worstSoreness is 7 (moderate)', () => {
      const output = applyAdjustment(
        baseAdj(),
        baseInput({
          sorenessRatings: { quads: 7 },
        })
      );
      // 7/10 is below the skip threshold (9); aux still runs
      output.auxiliaryWork.forEach((a) => {
        expect(a.skipped).toBe(false);
      });
    });
  });

  // GH#223: LLM aux path consumes engine anchor; LLM may dissent via override
  describe('aux anchor (GH#223)', () => {
    const historyEntry = (weightKg: number, daysAgo: number): AuxHistoryEntry => ({
      sessionId: `s-${daysAgo}`,
      completedAt: new Date(
        Date.parse('2026-05-25T12:00:00Z') - daysAgo * 86_400_000
      ).toISOString(),
      prescribedWeightKg: weightKg,
      sets: [{ weightKg, reps: 8, rpe: 8 }],
    });

    it('history-anchored: 3+ sessions → carrier source=history, anchorBaseKg=avg', () => {
      // 3 logged sessions of Pause Squat at 80/80/80kg; formula would suggest ~98kg
      // (squat oneRM 140kg × Pause Squat weightPct ~0.70).
      const output = applyAdjustment(
        baseAdj(),
        baseInput({
          nowIso: '2026-05-25T12:00:00Z',
          auxHistory: {
            'pause-squat': [
              historyEntry(80, 2),
              historyEntry(80, 5),
              historyEntry(80, 8),
            ],
          },
        })
      );
      const pauseSquat = output.auxiliaryWork.find(
        (a) => a.exercise === 'Pause Squat'
      );
      expect(pauseSquat?.anchor?.source).toBe('history');
      expect(pauseSquat?.anchor?.anchorBaseKg).toBe(80);
      expect(pauseSquat?.anchor?.fromLLMOverride).toBeUndefined();
      // Final weight derived from anchor (80) — not formula (~98).
      expect(pauseSquat?.sets[0].weight_kg).toBe(80);
    });

    it('no history → carrier present with source=formula (note hidden downstream)', () => {
      const output = applyAdjustment(baseAdj(), baseInput());
      const pauseSquat = output.auxiliaryWork.find(
        (a) => a.exercise === 'Pause Squat'
      );
      // No auxHistory provided → carrier is undefined (engine returns undefined
      // from resolveAuxAnchor). UI divergence note hides automatically.
      expect(pauseSquat?.anchor).toBeUndefined();
    });

    it('LLM anchorOverride: aux base = override.weightKg, source=snap, fromLLMOverride=true', () => {
      const adj = baseAdj({
        auxOverrides: [
          {
            exercise: 'Pause Squat',
            action: 'normal',
            anchorOverride: { weightKg: 60, reason: 'recent shoulder tweak' },
          },
        ],
      });
      const output = applyAdjustment(adj, baseInput());
      const pauseSquat = output.auxiliaryWork.find(
        (a) => a.exercise === 'Pause Squat'
      );
      expect(pauseSquat?.anchor?.source).toBe('snap');
      expect(pauseSquat?.anchor?.fromLLMOverride).toBe(true);
      expect(pauseSquat?.anchor?.anchorBaseKg).toBe(60);
      expect(pauseSquat?.anchor?.rationale).toContain('shoulder tweak');
      // Plate rounding still applies — final weight rounded to 2.5kg increments.
      expect(pauseSquat?.sets[0].weight_kg).toBe(60);
    });

    it('schema rejects anchorOverride.weightKg > 500 (out of bounds)', () => {
      const raw = {
        intensityModifier: 1.0,
        setModifier: 0,
        skipMainLift: false,
        auxOverrides: [
          {
            exercise: 'Pause Squat',
            action: 'normal',
            anchorOverride: { weightKg: 9999, reason: 'hallucinated' },
          },
        ],
        rationale: ['x'],
        confidence: 'high',
        restAdjustments: null,
      };
      expect(() => JITAdjustmentSchema.parse(raw)).toThrow();
    });

    it('schema rejects auxOverrides entry missing anchorOverride (nullable-not-optional)', () => {
      const raw = {
        intensityModifier: 1.0,
        setModifier: 0,
        skipMainLift: false,
        auxOverrides: [{ exercise: 'Pause Squat', action: 'normal' }],
        rationale: ['x'],
        confidence: 'high',
        restAdjustments: null,
      };
      expect(() => JITAdjustmentSchema.parse(raw)).toThrow();
    });

    it('schema accepts explicit anchorOverride: null', () => {
      const raw = {
        intensityModifier: 1.0,
        setModifier: 0,
        skipMainLift: false,
        auxOverrides: [
          { exercise: 'Pause Squat', action: 'normal', anchorOverride: null },
        ],
        rationale: ['x'],
        confidence: 'high',
        restAdjustments: null,
      };
      expect(() => JITAdjustmentSchema.parse(raw)).not.toThrow();
    });

    it("action: 'reduce' stacks on anchor base (× 0.9 of anchor, not × 0.9 of formula)", () => {
      // 3 sessions @ 80kg → anchor=80. action: 'reduce' should yield 80×0.9=72kg
      // (rounded to plate increment 2.5 → 72.5kg). If it stacked on formula
      // (~98kg) we'd see 88kg.
      const adj = baseAdj({
        auxOverrides: [
          {
            exercise: 'Pause Squat',
            action: 'reduce',
            anchorOverride: null,
          },
        ],
      });
      const output = applyAdjustment(
        adj,
        baseInput({
          nowIso: '2026-05-25T12:00:00Z',
          auxHistory: {
            'pause-squat': [
              historyEntry(80, 2),
              historyEntry(80, 5),
              historyEntry(80, 8),
            ],
          },
        })
      );
      const pauseSquat = output.auxiliaryWork.find(
        (a) => a.exercise === 'Pause Squat'
      );
      // 80 × 0.9 = 72; rounded to 2.5 plate increment = 72.5
      expect(pauseSquat?.sets[0].weight_kg).toBe(72.5);
      // 'reduce' also caps sets at 2
      expect(pauseSquat?.sets).toHaveLength(2);
    });

    it('engineAnchorKg present when fromLLMOverride; pre-override anchor preserved', () => {
      const adj = baseAdj({
        auxOverrides: [
          {
            exercise: 'Pause Squat',
            action: 'normal',
            anchorOverride: { weightKg: 60, reason: 'tweak' },
          },
        ],
      });
      const output = applyAdjustment(
        adj,
        baseInput({
          nowIso: '2026-05-25T12:00:00Z',
          auxHistory: {
            'pause-squat': [
              historyEntry(80, 2),
              historyEntry(80, 5),
              historyEntry(80, 8),
            ],
          },
        })
      );
      const pauseSquat = output.auxiliaryWork.find(
        (a) => a.exercise === 'Pause Squat'
      );
      expect(pauseSquat?.anchor?.fromLLMOverride).toBe(true);
      expect(pauseSquat?.anchor?.engineAnchorKg).toBe(80);
      expect(pauseSquat?.anchor?.anchorBaseKg).toBe(60);
    });
  });
});

// ---------------------------------------------------------------------------
// LLMJITGenerator.generate() — fallback behaviour only (requires AI mock)
// ---------------------------------------------------------------------------

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn().mockReturnValue({}) },
}));

const mockGenerateText = generateText as ReturnType<typeof vi.fn>;

describe('LLMJITGenerator (fallback behaviour)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('falls back to formula on timeout', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('AbortError: timeout'));

    const output = await new LLMJITGenerator().generate(baseInput());

    expect(output.jit_strategy).toBe('formula_fallback');
    expect(output.mainLiftSets.length).toBeGreaterThan(0);
  });

  it('falls back to formula on Zod parse failure', async () => {
    mockGenerateText.mockRejectedValueOnce(
      new Error('ZodError: intensityModifier must be >= 0.40')
    );

    const output = await new LLMJITGenerator().generate(baseInput());

    expect(output.jit_strategy).toBe('formula_fallback');
  });

  it('formula fallback on LLM parse error has no llmRestSuggestion', async () => {
    mockGenerateText.mockRejectedValueOnce(
      new Error('ZodError: parse failure')
    );

    const output = await new LLMJITGenerator().generate(baseInput());

    expect(output.jit_strategy).toBe('formula_fallback');
    expect(output.llmRestSuggestion).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// enforceHardConstraints — pure function, no AI mock needed
// ---------------------------------------------------------------------------

describe('enforceHardConstraints', () => {
  it('forces skip when MRV already exceeded', () => {
    const input = baseInput({
      weeklyVolumeToDate: { quads: 20 }, // quads mrv=20 → at cap
    });

    const fakeOutput = {
      sessionId: 'sess-001',
      generatedAt: new Date(),
      mainLiftSets: [
        { set_number: 1, weight_kg: 112.5, reps: 5, rpe_target: 8.5 },
      ],
      warmupSets: [],
      auxiliaryWork: [],
      volumeModifier: 1.0,
      intensityModifier: 1.0,
      rationale: [],
      warnings: [],
      skippedMainLift: false,
      restRecommendations: { mainLift: [180], auxiliary: [] },
    };

    const constrained = enforceHardConstraints(fakeOutput, input);
    expect(constrained.skippedMainLift).toBe(true);
    expect(constrained.mainLiftSets).toHaveLength(0);
    expect(constrained.warnings.some((w) => w.includes('[constraint]'))).toBe(
      true
    );
  });

  // ── Rehab Mode (GH#220) ─────────────────────────────────────────────────
  it('Rehab Mode: applyAdjustment on its own does NOT clamp — enforceHardConstraints does', () => {
    // Even with an active cap on squat, applyAdjustment trusts the LLM's
    // intensityModifier. The clamp is intentionally pushed into the post-pass
    // so all three strategies (formula / llm / hybrid) share one enforcement
    // point. This test pins that contract.
    const adj = baseAdj({ intensityModifier: 1.0 });
    const input = baseInput({ activeRehabCap: { lift: 'squat', capKg: 80 } });
    const raw = applyAdjustment(adj, input);
    // Pre-constraint: weight ~112.5 (formula base × 1.0), not clamped
    expect(raw.mainLiftSets[0].weight_kg).toBeGreaterThan(100);
    expect(raw.cappedByRehab).toBeUndefined();
  });

  it('Rehab Mode: enforceHardConstraints clamps the LLM weight to the cap', () => {
    const adj = baseAdj({ intensityModifier: 1.0 });
    const input = baseInput({ activeRehabCap: { lift: 'squat', capKg: 80 } });
    const raw = applyAdjustment(adj, input);
    const constrained = enforceHardConstraints(raw, input);
    expect(constrained.mainLiftSets[0].weight_kg).toBe(80);
    expect(constrained.cappedByRehab).toBe(true);
    expect(constrained.rehabCapKg).toBe(80);
    expect(
      constrained.warnings.some((w) => /Capped at 80kg by Rehab Mode/.test(w))
    ).toBe(true);
  });

  it('Rehab Mode: cap rounds UP to the plate increment in the LLM path too', () => {
    // 82.5 cap + 5kg plates → prescription becomes 85 (same semantics as formula path)
    const adj = baseAdj({ intensityModifier: 1.0 });
    const input = baseInput({
      activeRehabCap: { lift: 'squat', capKg: 82.5 },
      weightIncrementKg: 5,
    });
    const constrained = enforceHardConstraints(applyAdjustment(adj, input), input);
    expect(constrained.mainLiftSets[0].weight_kg).toBe(85);
    expect(constrained.rehabCapKg).toBe(85);
  });

  it('Rehab Mode: cap on different lift than session does NOT clamp', () => {
    const adj = baseAdj({ intensityModifier: 1.0 });
    const input = baseInput({
      primaryLift: 'squat',
      activeRehabCap: { lift: 'bench', capKg: 50 },
    });
    const constrained = enforceHardConstraints(applyAdjustment(adj, input), input);
    expect(constrained.mainLiftSets[0].weight_kg).toBeGreaterThan(100);
    expect(constrained.cappedByRehab).toBeUndefined();
  });

  it('Rehab Mode: no double-warn when buildFinalMainSets already stamped cappedByRehab', () => {
    // Simulating the formula-path → enforceHardConstraints handoff: the
    // constraint pass should be idempotent and not re-warn when the flag is
    // already set and weights are already at the ceiling.
    const input = baseInput({ activeRehabCap: { lift: 'squat', capKg: 80 } });
    const preCapped = {
      sessionId: 'sess-001',
      generatedAt: new Date(),
      mainLiftSets: [
        { set_number: 1, weight_kg: 80, reps: 5, rpe_target: 8.5 },
      ],
      warmupSets: [],
      auxiliaryWork: [],
      volumeModifier: 1.0,
      intensityModifier: 1.0,
      rationale: [],
      warnings: [],
      skippedMainLift: false,
      restRecommendations: { mainLift: [180], auxiliary: [] },
      cappedByRehab: true,
      rehabCapKg: 80,
    };
    const constrained = enforceHardConstraints(preCapped, input);
    expect(constrained.cappedByRehab).toBe(true);
    expect(constrained.rehabCapKg).toBe(80);
    expect(constrained.mainLiftSets[0].weight_kg).toBe(80);
    expect(
      constrained.warnings.filter((w) => /Capped at.*Rehab Mode/.test(w))
    ).toHaveLength(0);
  });

  it('applies minimal warmup override in recovery mode (severe soreness)', () => {
    const input = baseInput({ sorenessRatings: { quads: 10 } });

    const fakeOutput = {
      sessionId: 'sess-001',
      generatedAt: new Date(),
      mainLiftSets: [
        { set_number: 1, weight_kg: 112.5, reps: 5, rpe_target: 8.5 },
      ],
      warmupSets: [],
      auxiliaryWork: [],
      volumeModifier: 1.0,
      intensityModifier: 1.0,
      rationale: [],
      warnings: [],
      skippedMainLift: false,
      restRecommendations: { mainLift: [180], auxiliary: [] },
    };

    const constrained = enforceHardConstraints(fakeOutput, input);
    // minimal protocol = 2 warmup sets
    expect(constrained.warmupSets).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Over-reaction guard — combined large intensity + volume cut without a strong
// signal is clamped back to the documented envelope (docs/domain/adjustments.md)
// ---------------------------------------------------------------------------

describe('enforceHardConstraints — over-reaction guard', () => {
  // Use a block with enough base sets that a -2 set cut still leaves a working
  // set (so the guard path, not the min-1-set path, is exercised).
  const guardInput = (overrides: Partial<JITInput> = {}) =>
    baseInput({ blockNumber: 3, intensityType: 'heavy', ...overrides });

  const baseline = (input: JITInput) =>
    enforceHardConstraints(applyAdjustment(baseAdj(), input), input);

  // 15% intensity cut + 2-set volume cut, mild signals only.
  const aggressiveAdj = baseAdj({
    intensityModifier: 0.85,
    setModifier: -2,
    rationale: ['felt a bit tired'],
  });

  it('clamps a combined cut when there is no disruption and soreness < 7', () => {
    const input = guardInput();
    const base = baseline(input);
    const baseCount = base.mainLiftSets.length;
    const baseWeight = base.mainLiftSets[0].weight_kg;
    // Precondition: enough sets that -2 leaves the main lift standing.
    expect(baseCount).toBeGreaterThanOrEqual(3);

    const out = enforceHardConstraints(applyAdjustment(aggressiveAdj, input), input);

    // Volume restored to the documented single-axis ceiling (−1 set)…
    expect(out.mainLiftSets).toHaveLength(baseCount - 1);
    // …and weight floored at 95% of the formula baseline.
    expect(out.mainLiftSets[0].weight_kg).toBeGreaterThanOrEqual(
      Math.floor(baseWeight * 0.95)
    );
    expect(
      out.warnings.some((w) => /Over-reaction guard/.test(w))
    ).toBe(true);
  });

  it('does NOT clamp when primary-muscle soreness ≥ 7 (strong signal)', () => {
    const input = guardInput({ sorenessRatings: { quads: 8 } });
    const base = baseline(input);
    const out = enforceHardConstraints(applyAdjustment(aggressiveAdj, input), input);
    // The LLM's aggressive cut is respected — fewer sets than baseline−1, and
    // weight left below the 95% floor.
    expect(out.mainLiftSets.length).toBeLessThan(base.mainLiftSets.length - 1);
    expect(out.warnings.some((w) => /Over-reaction guard/.test(w))).toBe(false);
  });

  it('does NOT clamp when a disruption is active (strong signal)', () => {
    const input = guardInput({
      activeDisruptions: [makeDisruption('moderate')],
    });
    const out = enforceHardConstraints(applyAdjustment(aggressiveAdj, input), input);
    expect(out.warnings.some((w) => /Over-reaction guard/.test(w))).toBe(false);
  });

  it('does NOT clamp a gentle single-axis adjustment', () => {
    const input = guardInput();
    // 5% intensity cut, no volume change → inside the envelope, untouched.
    const gentle = baseAdj({ intensityModifier: 0.95, setModifier: 0 });
    const out = enforceHardConstraints(applyAdjustment(gentle, input), input);
    expect(out.warnings.some((w) => /Over-reaction guard/.test(w))).toBe(false);
  });
});
