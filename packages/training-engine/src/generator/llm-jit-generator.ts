import { generateObject } from 'ai'
import { JITAdjustmentSchema } from '@parakeet/shared-types'
import type { JITAdjustment } from '@parakeet/shared-types'
import type { JITGeneratorStrategy } from './jit-strategy'
import type { JITInput, JITOutput, AuxiliaryWork } from './jit-session-generator'
import { FormulaJITGenerator } from './formula-jit-generator'
import { enforceHardConstraints } from './jit-constraints'
import { JIT_MODEL } from '../ai/models'
import { JIT_SYSTEM_PROMPT } from '../ai/prompts'
import { calculateSets } from './set-calculator'
import { roundToNearest } from '../formulas/weight-rounding'
import { generateWarmupSets } from './warmup-calculator'

// helper: derive formula-based rest for LLM path (engine-021 will override later)
function formulaRestForMain(input: JITInput): number {
  const { formulaConfig, blockNumber, intensityType } = input
  if (intensityType === 'deload') return formulaConfig.rest_seconds.deload
  const blockKey = `block${blockNumber}` as 'block1' | 'block2' | 'block3'
  return formulaConfig.rest_seconds[blockKey][intensityType as 'heavy' | 'explosive' | 'rep']
}

export class LLMJITGenerator implements JITGeneratorStrategy {
  readonly name = 'llm' as const
  readonly description = 'LLM-based holistic generator — requires network'

  async generate(input: JITInput): Promise<JITOutput> {
    try {
      const { object } = await generateObject({
        model: JIT_MODEL,
        schema: JITAdjustmentSchema,
        system: JIT_SYSTEM_PROMPT,
        prompt: JSON.stringify(buildJITContext(input)),
        abortSignal: AbortSignal.timeout(5000),
      })
      const output = applyAdjustment(object, input)
      return { ...enforceHardConstraints(output, input), jit_strategy: 'llm' }
    } catch {
      const fallback = await new FormulaJITGenerator().generate(input)
      return { ...fallback, jit_strategy: 'formula_fallback' }
    }
  }
}

function buildJITContext(input: JITInput): object {
  // Omit warmupConfig — always formula-generated; LLM cannot override warmup
  const { warmupConfig: _warmup, ...rest } = input

  // Provide rest context so the LLM can make an informed rest adjustment
  const formulaRestSeconds = formulaRestForMain(input)
  const lastSetRpe =
    input.recentLogs.length > 0
      ? input.recentLogs[input.recentLogs.length - 1].actual_rpe
      : null

  return {
    ...rest,
    formulaRestSeconds,
    ...(lastSetRpe !== null ? { lastSetRpe } : {}),
  }
}

function applyAdjustment(adj: JITAdjustment, input: JITInput): JITOutput {
  const baseSets = calculateSets(
    input.primaryLift,
    input.intensityType,
    input.blockNumber,
    input.oneRmKg,
    input.formulaConfig,
  )
  const baseWeight = baseSets[0]?.weight_kg ?? 0

  let mainLiftSets = baseSets
  let skippedMainLift = adj.skipMainLift

  if (!skippedMainLift) {
    const targetCount = Math.max(0, baseSets.length + adj.setModifier)
    const finalWeight = roundToNearest(baseWeight * adj.intensityModifier)
    mainLiftSets = baseSets.slice(0, targetCount).map((s, i) => ({
      ...s,
      set_number: i + 1,
      weight_kg: finalWeight,
    }))
    if (mainLiftSets.length === 0) {
      skippedMainLift = true
    }
  } else {
    mainLiftSets = []
  }

  // Apply aux overrides
  const auxiliaryWork: AuxiliaryWork[] = input.activeAuxiliaries.map((exercise) => {
    const override: 'skip' | 'reduce' | 'normal' | undefined = adj.auxOverrides[exercise]
    if (override === 'skip') {
      return { exercise, sets: [], skipped: true, skipReason: 'LLM: skip override' }
    }
    const baseAuxWeight = roundToNearest(input.oneRmKg * 0.675)
    const auxWeight = override === 'reduce' ? roundToNearest(baseAuxWeight * 0.90) : baseAuxWeight
    const setCount = override === 'reduce' ? 2 : 3
    return {
      exercise,
      sets: Array.from({ length: setCount }, (_, i) => ({
        set_number: i + 1,
        weight_kg: auxWeight,
        reps: 10,
        rpe_target: 7.5,
      })),
      skipped: false,
    }
  })

  const warmupSets =
    mainLiftSets.length > 0 && !skippedMainLift
      ? generateWarmupSets(mainLiftSets[0].weight_kg, input.warmupConfig)
      : []

  const volumeModifier = baseSets.length > 0 ? mainLiftSets.length / baseSets.length : 1.0
  const intensityModifier = skippedMainLift ? 0 : adj.intensityModifier

  // Apply rest adjustment from LLM if provided (engine-021)
  const formulaBase = formulaRestForMain(input)
  const rawDelta = adj.restAdjustments?.mainLift ?? 0
  const clampedDelta = Math.max(-60, Math.min(60, rawDelta))

  if (clampedDelta !== rawDelta) {
    console.warn(
      `[LLMJITGenerator] restAdjustments.mainLift ${rawDelta}s exceeded allowed range [-60, 60] — clamped to ${clampedDelta}s`,
    )
  }

  const mainLiftRest = formulaBase + clampedDelta
  const restRecommendations = {
    mainLift: mainLiftSets.map(() => mainLiftRest),
    auxiliary: auxiliaryWork.map(() => input.formulaConfig.rest_seconds.auxiliary),
  }

  // Only populate llmRestSuggestion when the LLM actually returned a restAdjustments field
  const llmRestSuggestion =
    adj.restAdjustments !== undefined
      ? { deltaSeconds: clampedDelta, formulaBaseSeconds: formulaBase }
      : undefined

  return {
    sessionId: input.sessionId,
    generatedAt: new Date(),
    mainLiftSets,
    warmupSets,
    auxiliaryWork,
    volumeModifier,
    intensityModifier,
    rationale: adj.rationale,
    warnings: [],
    skippedMainLift,
    restRecommendations,
    ...(llmRestSuggestion !== undefined ? { llmRestSuggestion } : {}),
  }
}
