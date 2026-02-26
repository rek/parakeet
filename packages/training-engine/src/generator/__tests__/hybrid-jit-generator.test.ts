import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateObject } from 'ai'
import { DEFAULT_FORMULA_CONFIG_MALE } from '../../cube/blocks'
import type { MrvMevConfig, MuscleGroup } from '../../types'
import type { JITInput } from '../jit-session-generator'
import { HybridJITGenerator, computeDivergence } from '../hybrid-jit-generator'
import { LLMJITGenerator } from '../llm-jit-generator'
import { FormulaJITGenerator } from '../formula-jit-generator'

vi.mock('ai', () => ({ generateObject: vi.fn() }))
const mockGenerateObject = generateObject as ReturnType<typeof vi.fn>

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
    sessionId: 'sess-hybrid-001',
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

/** Build a minimal LLM response object accepted by JITAdjustmentSchema */
function llmAdj(overrides: object = {}) {
  return {
    intensityModifier: 1.0,
    setModifier: 0,
    skipMainLift: false,
    auxOverrides: {},
    rationale: ['Normal session'],
    confidence: 'high' as const,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// computeDivergence unit tests
// ---------------------------------------------------------------------------

describe('computeDivergence', () => {
  it('returns zero divergence when both outputs are identical', () => {
    const base = {
      mainLiftSets: [{ set_number: 1, weight_kg: 100, reps: 5, rpe_target: 8 }],
      rationale: ['Same'],
    } as Parameters<typeof computeDivergence>[0]

    const result = computeDivergence(base, base)
    expect(result.weightPct).toBe(0)
    expect(result.setDelta).toBe(0)
    expect(result.rpeContextSummary).toBe('Same')
  })

  it('computes correct weightPct and setDelta for divergent outputs', () => {
    const formula = {
      mainLiftSets: [
        { set_number: 1, weight_kg: 100, reps: 5, rpe_target: 8 },
        { set_number: 2, weight_kg: 100, reps: 5, rpe_target: 8 },
      ],
      rationale: [],
    } as Parameters<typeof computeDivergence>[0]

    const llm = {
      mainLiftSets: [{ set_number: 1, weight_kg: 80, reps: 5, rpe_target: 8 }],
      rationale: ['Injury context'],
    } as Parameters<typeof computeDivergence>[0]

    const result = computeDivergence(formula, llm)
    expect(result.weightPct).toBeCloseTo(0.2) // |80-100|/100
    expect(result.setDelta).toBe(-1)           // 1 - 2
    expect(result.rpeContextSummary).toBe('Injury context')
  })

  it('returns weightPct 0 when formula has no sets', () => {
    const formula = { mainLiftSets: [], rationale: [] } as Parameters<typeof computeDivergence>[0]
    const llm = {
      mainLiftSets: [{ set_number: 1, weight_kg: 100, reps: 5, rpe_target: 8 }],
      rationale: [],
    } as Parameters<typeof computeDivergence>[0]

    const result = computeDivergence(formula, llm)
    expect(result.weightPct).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// HybridJITGenerator integration tests
// ---------------------------------------------------------------------------

describe('HybridJITGenerator', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns LLM output when both agree within 10% and same set count', async () => {
    // Formula: block1 heavy 140kg → 4 sets @ 112.5kg (DEFAULT_FORMULA_CONFIG_MALE)
    // LLM: same set count, weight within 10% → should agree
    mockGenerateObject.mockResolvedValueOnce({
      object: llmAdj({ intensityModifier: 1.0, setModifier: 0 }),
    })

    const gen = new HybridJITGenerator()
    const output = await gen.generate(baseInput())

    expect(output.jit_strategy).toBe('llm')
    expect(output.comparisonData).toBeDefined()
    expect(output.comparisonData!.shouldSurfaceToUser).toBe(false)
    expect(output.comparisonData!.formulaOutput).toBeDefined()
    expect(output.comparisonData!.divergence.setDelta).toBe(0)
  })

  it('sets shouldSurfaceToUser: true when weight diverges >15%', async () => {
    // LLM returns intensityModifier: 0.80 → 80% of formula weight → 20% divergence
    mockGenerateObject.mockResolvedValueOnce({
      object: llmAdj({ intensityModifier: 0.80, setModifier: 0 }),
    })

    const gen = new HybridJITGenerator()
    const output = await gen.generate(baseInput())

    expect(output.jit_strategy).toBe('llm')
    expect(output.comparisonData).toBeDefined()
    expect(output.comparisonData!.shouldSurfaceToUser).toBe(true)
    expect(output.comparisonData!.divergence.weightPct).toBeGreaterThan(0.15)
    expect(output.comparisonData!.formulaOutput.mainLiftSets.length).toBeGreaterThan(0)
  })

  it('sets shouldSurfaceToUser: true when set count differs', async () => {
    // LLM drops 1 set via setModifier: -1
    mockGenerateObject.mockResolvedValueOnce({
      object: llmAdj({ intensityModifier: 1.0, setModifier: -1 }),
    })

    const gen = new HybridJITGenerator()
    const output = await gen.generate(baseInput())

    expect(output.jit_strategy).toBe('llm')
    expect(output.comparisonData!.shouldSurfaceToUser).toBe(true)
    expect(output.comparisonData!.divergence.setDelta).toBe(-1)
  })

  it('falls back to formula with jit_strategy formula_fallback when LLM rejects', async () => {
    // Directly mock LLMJITGenerator.generate to reject — LLMJITGenerator internally catches
    // generateObject errors, so we must mock at the generate() boundary to simulate true rejection.
    const llmGen = new LLMJITGenerator()
    vi.spyOn(llmGen, 'generate').mockRejectedValueOnce(new Error('Network timeout'))

    const gen = new HybridJITGenerator(new FormulaJITGenerator(), llmGen)
    const output = await gen.generate(baseInput())

    expect(output.jit_strategy).toBe('formula_fallback')
    expect(output.mainLiftSets.length).toBeGreaterThan(0)
    expect(output.comparisonData).toBeUndefined()
  })

  it('preserves formula output in comparisonData.formulaOutput', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: llmAdj({ intensityModifier: 0.75, setModifier: -1 }),
    })

    const gen = new HybridJITGenerator()
    const output = await gen.generate(baseInput())

    expect(output.comparisonData).toBeDefined()
    const formulaOutput = output.comparisonData!.formulaOutput
    expect(formulaOutput.sessionId).toBe('sess-hybrid-001')
    expect(formulaOutput.mainLiftSets.length).toBeGreaterThan(0)
    // Formula output should have normal (unmodified) weight
    expect(formulaOutput.mainLiftSets[0].weight_kg).toBeGreaterThan(
      output.mainLiftSets[0]?.weight_kg ?? 0,
    )
  })

  it('calls the comparisonLogger when provided', async () => {
    const logger = vi.fn()
    mockGenerateObject.mockResolvedValueOnce({
      object: llmAdj({ intensityModifier: 0.80, setModifier: 0 }),
    })

    const gen = new HybridJITGenerator(undefined, undefined, logger)
    await gen.generate(baseInput())

    expect(logger).toHaveBeenCalledTimes(1)
    const [logInput, logFormula, logLlm, logDivergence] = logger.mock.calls[0]
    expect(logInput.sessionId).toBe('sess-hybrid-001')
    expect(logFormula.mainLiftSets.length).toBeGreaterThan(0)
    expect(logLlm.mainLiftSets.length).toBeGreaterThan(0)
    expect(typeof logDivergence.weightPct).toBe('number')
  })

  it('does not call logger when LLM fails', async () => {
    const logger = vi.fn()
    const llmGen = new LLMJITGenerator()
    vi.spyOn(llmGen, 'generate').mockRejectedValueOnce(new Error('timeout'))

    const gen = new HybridJITGenerator(new FormulaJITGenerator(), llmGen, logger)
    await gen.generate(baseInput())

    expect(logger).not.toHaveBeenCalled()
  })

  it('does not call logger when no logger provided (no error)', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: llmAdj(),
    })

    const gen = new HybridJITGenerator()
    // should not throw even with no logger
    await expect(gen.generate(baseInput())).resolves.toBeDefined()
  })
})
