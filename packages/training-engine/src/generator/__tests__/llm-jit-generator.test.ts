import type { JITAdjustment } from '@parakeet/shared-types';
import { generateText } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { atMevExcept } from '../../__test-helpers__/fixtures';
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

  describe('rest adjustments (engine-021)', () => {
    it('applies +60s rest delta', () => {
      const output = applyAdjustment(
        baseAdj({ restAdjustments: { mainLift: 60 } }),
        baseInput()
      );

      const formulaBase = DEFAULT_FORMULA_CONFIG_MALE.rest_seconds.block1.heavy;
      expect(output.restRecommendations.mainLift.length).toBeGreaterThan(0);
      output.restRecommendations.mainLift.forEach((r) => {
        expect(r).toBe(formulaBase + 60);
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
      output.restRecommendations.mainLift.forEach((r) => {
        expect(r).toBe(formulaBase + 60); // clamped to 60, not 90
      });
      expect(output.llmRestSuggestion).toEqual({
        deltaSeconds: 60,
        formulaBaseSeconds: formulaBase,
      });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('clamped'));
      warnSpy.mockRestore();
    });

    it('applies -30s rest delta', () => {
      const output = applyAdjustment(
        baseAdj({ restAdjustments: { mainLift: -30 } }),
        baseInput()
      );

      const formulaBase = DEFAULT_FORMULA_CONFIG_MALE.rest_seconds.block1.heavy;
      output.restRecommendations.mainLift.forEach((r) => {
        expect(r).toBe(formulaBase - 30);
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

    it('deload bypasses proportional clamp', () => {
      const adj = baseAdj({ intensityModifier: 0.7, setModifier: -1 });
      const output = applyAdjustment(
        adj,
        baseInput({ intensityType: 'deload' })
      );
      // Deload: aux gets 3 sets at full weight regardless of main cut
      output.auxiliaryWork.forEach((a) => {
        expect(a.sets).toHaveLength(3);
      });
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
