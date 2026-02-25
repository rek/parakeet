import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateObject } from 'ai'
import { DEFAULT_FORMULA_CONFIG } from '../../cube/blocks'
import type { MrvMevConfig, MuscleGroup } from '../../types'
import type { JITInput } from '../jit-session-generator'
import { LLMJITGenerator } from '../llm-jit-generator'
import { enforceHardConstraints } from '../jit-constraints'

vi.mock('ai', () => ({ generateObject: vi.fn() }))
const mockGenerateObject = generateObject as ReturnType<typeof vi.fn>

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
    formulaConfig: DEFAULT_FORMULA_CONFIG,
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

describe('LLMJITGenerator', () => {
  beforeEach(() => vi.clearAllMocks())

  it('applies LLM adjustment to base weight', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        intensityModifier: 0.90,
        setModifier: -1,
        skipMainLift: false,
        auxOverrides: {},
        rationale: ['Minor soreness — reducing intensity'],
        confidence: 'high',
      },
    })

    const gen = new LLMJITGenerator()
    const output = await gen.generate(baseInput())

    expect(output.jit_strategy).toBe('llm')
    // Block 1 Heavy squat 140kg → base weight 112.5kg; 0.90 × 112.5 = 101.25 → rounds to 101.25 or nearest 2.5
    expect(output.mainLiftSets.length).toBeGreaterThan(0)
    expect(output.mainLiftSets[0].weight_kg).toBeLessThan(112.5)
    expect(output.rationale).toContain('Minor soreness — reducing intensity')
  })

  it('falls back to formula on timeout', async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error('AbortError: timeout'))

    const gen = new LLMJITGenerator()
    const output = await gen.generate(baseInput())

    expect(output.jit_strategy).toBe('formula_fallback')
    expect(output.mainLiftSets.length).toBeGreaterThan(0)
  })

  it('falls back to formula on Zod parse failure', async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error('ZodError: intensityModifier must be >= 0.40'))

    const gen = new LLMJITGenerator()
    const output = await gen.generate(baseInput())

    expect(output.jit_strategy).toBe('formula_fallback')
  })

  it('enforceHardConstraints forces skip when MRV already exceeded', () => {
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
    }

    const constrained = enforceHardConstraints(fakeOutput, input)
    expect(constrained.skippedMainLift).toBe(true)
    expect(constrained.mainLiftSets).toHaveLength(0)
    expect(constrained.warnings.some((w) => w.includes('[constraint]'))).toBe(true)
  })
})
