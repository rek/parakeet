import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DEFAULT_FORMULA_CONFIG_MALE } from '../../cube/blocks'
import type { MrvMevConfig, MuscleGroup } from '../../types'
import type { JITInput } from '../jit-session-generator'
import type { JITAdjustment } from '@parakeet/shared-types'
import { LLMJITGenerator, applyAdjustment } from '../llm-jit-generator'
import { enforceHardConstraints } from '../jit-constraints'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMrvMev(
  overrides: Partial<Record<MuscleGroup, { mev: number; mrv: number }>> = {},
): MrvMevConfig {
  const defaults: MrvMevConfig = {
    quads: { mev: 8, mrv: 20 },
    hamstrings: { mev: 6, mrv: 16 },
    glutes: { mev: 6, mrv: 18 },
    lower_back: { mev: 4, mrv: 12 },
    upper_back: { mev: 8, mrv: 20 },
    chest: { mev: 8, mrv: 20 },
    triceps: { mev: 6, mrv: 16 },
    shoulders: { mev: 6, mrv: 16 },
    biceps: { mev: 4, mrv: 12 },
  }
  return { ...defaults, ...overrides }
}

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
    mrvMevConfig: makeMrvMev(),
    activeAuxiliaries: ['Pause Squat', 'Box Squat'],
    recentLogs: [],
    activeDisruptions: [],
    warmupConfig: { type: 'preset', name: 'standard' },
    ...overrides,
  }
}

function baseAdj(overrides: Partial<JITAdjustment> = {}): JITAdjustment {
  return {
    intensityModifier: 1.0,
    setModifier: 0,
    skipMainLift: false,
    auxOverrides: {},
    rationale: ['Normal session'],
    confidence: 'high',
    ...overrides,
  }
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
    })
    const output = applyAdjustment(adj, baseInput())

    // Block 1 Heavy squat 140kg → base weight ~112.5kg; 0.90 × 112.5 < 112.5
    expect(output.mainLiftSets.length).toBeGreaterThan(0)
    expect(output.mainLiftSets[0].weight_kg).toBeLessThan(112.5)
    expect(output.rationale).toContain('Minor soreness — reducing intensity')
  })

  describe('rest adjustments (engine-021)', () => {
    it('applies +60s rest delta', () => {
      const output = applyAdjustment(baseAdj({ restAdjustments: { mainLift: 60 } }), baseInput())

      const formulaBase = DEFAULT_FORMULA_CONFIG_MALE.rest_seconds.block1.heavy
      expect(output.restRecommendations.mainLift.length).toBeGreaterThan(0)
      output.restRecommendations.mainLift.forEach((r) => {
        expect(r).toBe(formulaBase + 60)
      })
      expect(output.llmRestSuggestion).toEqual({ deltaSeconds: 60, formulaBaseSeconds: formulaBase })
    })

    it('clamps restAdjustments.mainLift to 60 when LLM returns 90', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const output = applyAdjustment(baseAdj({ restAdjustments: { mainLift: 90 } }), baseInput())

      const formulaBase = DEFAULT_FORMULA_CONFIG_MALE.rest_seconds.block1.heavy
      output.restRecommendations.mainLift.forEach((r) => {
        expect(r).toBe(formulaBase + 60) // clamped to 60, not 90
      })
      expect(output.llmRestSuggestion).toEqual({ deltaSeconds: 60, formulaBaseSeconds: formulaBase })
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('clamped'))
      warnSpy.mockRestore()
    })

    it('applies -30s rest delta', () => {
      const output = applyAdjustment(baseAdj({ restAdjustments: { mainLift: -30 } }), baseInput())

      const formulaBase = DEFAULT_FORMULA_CONFIG_MALE.rest_seconds.block1.heavy
      output.restRecommendations.mainLift.forEach((r) => {
        expect(r).toBe(formulaBase - 30)
      })
      expect(output.llmRestSuggestion).toEqual({ deltaSeconds: -30, formulaBaseSeconds: formulaBase })
    })

    it('leaves rest unchanged and llmRestSuggestion undefined when restAdjustments omitted', () => {
      const output = applyAdjustment(baseAdj(), baseInput())

      const formulaBase = DEFAULT_FORMULA_CONFIG_MALE.rest_seconds.block1.heavy
      output.restRecommendations.mainLift.forEach((r) => {
        expect(r).toBe(formulaBase)
      })
      expect(output.llmRestSuggestion).toBeUndefined()
    })
  })
})

// ---------------------------------------------------------------------------
// LLMJITGenerator.generate() — fallback behaviour only (requires AI mock)
// ---------------------------------------------------------------------------

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn().mockReturnValue({}) },
}))

import { generateText } from 'ai'
const mockGenerateText = generateText as ReturnType<typeof vi.fn>

describe('LLMJITGenerator (fallback behaviour)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('falls back to formula on timeout', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('AbortError: timeout'))

    const output = await new LLMJITGenerator().generate(baseInput())

    expect(output.jit_strategy).toBe('formula_fallback')
    expect(output.mainLiftSets.length).toBeGreaterThan(0)
  })

  it('falls back to formula on Zod parse failure', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('ZodError: intensityModifier must be >= 0.40'))

    const output = await new LLMJITGenerator().generate(baseInput())

    expect(output.jit_strategy).toBe('formula_fallback')
  })

  it('formula fallback on LLM parse error has no llmRestSuggestion', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('ZodError: parse failure'))

    const output = await new LLMJITGenerator().generate(baseInput())

    expect(output.jit_strategy).toBe('formula_fallback')
    expect(output.llmRestSuggestion).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// enforceHardConstraints — pure function, no AI mock needed
// ---------------------------------------------------------------------------

describe('enforceHardConstraints', () => {
  it('forces skip when MRV already exceeded', () => {
    const input = baseInput({
      weeklyVolumeToDate: { quads: 20 }, // quads mrv=20 → at cap
    })

    const fakeOutput = {
      sessionId: 'sess-001',
      generatedAt: new Date(),
      mainLiftSets: [{ set_number: 1, weight_kg: 112.5, reps: 5, rpe_target: 8.5 }],
      warmupSets: [],
      auxiliaryWork: [],
      volumeModifier: 1.0,
      intensityModifier: 1.0,
      rationale: [],
      warnings: [],
      skippedMainLift: false,
      restRecommendations: { mainLift: [180], auxiliary: [] },
    }

    const constrained = enforceHardConstraints(fakeOutput, input)
    expect(constrained.skippedMainLift).toBe(true)
    expect(constrained.mainLiftSets).toHaveLength(0)
    expect(constrained.warnings.some((w) => w.includes('[constraint]'))).toBe(true)
  })
})
