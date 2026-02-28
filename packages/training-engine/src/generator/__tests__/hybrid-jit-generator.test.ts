import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DEFAULT_FORMULA_CONFIG_MALE } from '../../cube/blocks'
import type { MrvMevConfig, MuscleGroup } from '../../types'
import type { JITInput } from '../jit-session-generator'
import type { JITAdjustment } from '@parakeet/shared-types'
import { HybridJITGenerator, computeDivergence } from '../hybrid-jit-generator'
import { LLMJITGenerator, applyAdjustment } from '../llm-jit-generator'
import { FormulaJITGenerator } from '../formula-jit-generator'

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

/** Build a real JITOutput (no AI call) by applying an adjustment via the pure helper. */
function buildLlmOutput(adj: Partial<JITAdjustment>, input: JITInput) {
  const fullAdj: JITAdjustment = {
    intensityModifier: 1.0,
    setModifier: 0,
    skipMainLift: false,
    auxOverrides: {},
    rationale: ['Normal session'],
    confidence: 'high',
    ...adj,
  }
  return { ...applyAdjustment(fullAdj, input), jit_strategy: 'llm' as const }
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
// HybridJITGenerator integration tests — inject LLM output via spyOn
// ---------------------------------------------------------------------------

describe('HybridJITGenerator', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns LLM output when both agree within 10% and same set count', async () => {
    const input = baseInput()
    const llmGen = new LLMJITGenerator()
    // intensityModifier: 1.0, setModifier: 0 → same weight and count as formula
    vi.spyOn(llmGen, 'generate').mockResolvedValueOnce(buildLlmOutput({}, input))

    const gen = new HybridJITGenerator(new FormulaJITGenerator(), llmGen)
    const output = await gen.generate(input)

    expect(output.jit_strategy).toBe('llm')
    expect(output.comparisonData).toBeDefined()
    expect(output.comparisonData!.shouldSurfaceToUser).toBe(false)
    expect(output.comparisonData!.formulaOutput).toBeDefined()
    expect(output.comparisonData!.divergence.setDelta).toBe(0)
  })

  it('sets shouldSurfaceToUser: true when weight diverges >15%', async () => {
    const input = baseInput()
    const llmGen = new LLMJITGenerator()
    // 0.80 × formula weight → ~20% divergence
    vi.spyOn(llmGen, 'generate').mockResolvedValueOnce(
      buildLlmOutput({ intensityModifier: 0.8 }, input),
    )

    const gen = new HybridJITGenerator(new FormulaJITGenerator(), llmGen)
    const output = await gen.generate(input)

    expect(output.jit_strategy).toBe('llm')
    expect(output.comparisonData).toBeDefined()
    expect(output.comparisonData!.shouldSurfaceToUser).toBe(true)
    expect(output.comparisonData!.divergence.weightPct).toBeGreaterThan(0.15)
    expect(output.comparisonData!.formulaOutput.mainLiftSets.length).toBeGreaterThan(0)
  })

  it('sets shouldSurfaceToUser: true when set count differs', async () => {
    const input = baseInput()
    const llmGen = new LLMJITGenerator()
    vi.spyOn(llmGen, 'generate').mockResolvedValueOnce(
      buildLlmOutput({ setModifier: -1 }, input),
    )

    const gen = new HybridJITGenerator(new FormulaJITGenerator(), llmGen)
    const output = await gen.generate(input)

    expect(output.jit_strategy).toBe('llm')
    expect(output.comparisonData!.shouldSurfaceToUser).toBe(true)
    expect(output.comparisonData!.divergence.setDelta).toBe(-1)
  })

  it('falls back to formula with jit_strategy formula_fallback when LLM rejects', async () => {
    const llmGen = new LLMJITGenerator()
    vi.spyOn(llmGen, 'generate').mockRejectedValueOnce(new Error('Network timeout'))

    const gen = new HybridJITGenerator(new FormulaJITGenerator(), llmGen)
    const output = await gen.generate(baseInput())

    expect(output.jit_strategy).toBe('formula_fallback')
    expect(output.mainLiftSets.length).toBeGreaterThan(0)
    expect(output.comparisonData).toBeUndefined()
  })

  it('preserves formula output in comparisonData.formulaOutput', async () => {
    const input = baseInput()
    const llmGen = new LLMJITGenerator()
    vi.spyOn(llmGen, 'generate').mockResolvedValueOnce(
      buildLlmOutput({ intensityModifier: 0.75, setModifier: -1 }, input),
    )

    const gen = new HybridJITGenerator(new FormulaJITGenerator(), llmGen)
    const output = await gen.generate(input)

    expect(output.comparisonData).toBeDefined()
    const formulaOutput = output.comparisonData!.formulaOutput
    expect(formulaOutput.sessionId).toBe('sess-hybrid-001')
    expect(formulaOutput.mainLiftSets.length).toBeGreaterThan(0)
    // Formula weight unmodified > LLM weight at 0.75×
    expect(formulaOutput.mainLiftSets[0].weight_kg).toBeGreaterThan(
      output.mainLiftSets[0]?.weight_kg ?? 0,
    )
  })

  it('calls the comparisonLogger when provided', async () => {
    const logger = vi.fn()
    const input = baseInput()
    const llmGen = new LLMJITGenerator()
    vi.spyOn(llmGen, 'generate').mockResolvedValueOnce(
      buildLlmOutput({ intensityModifier: 0.8 }, input),
    )

    const gen = new HybridJITGenerator(new FormulaJITGenerator(), llmGen, logger)
    await gen.generate(input)

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
    const input = baseInput()
    const llmGen = new LLMJITGenerator()
    vi.spyOn(llmGen, 'generate').mockResolvedValueOnce(buildLlmOutput({}, input))

    const gen = new HybridJITGenerator(new FormulaJITGenerator(), llmGen)
    await expect(gen.generate(input)).resolves.toBeDefined()
  })
})
