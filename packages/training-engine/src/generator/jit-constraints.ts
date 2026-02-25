import type { JITInput, JITOutput } from './jit-session-generator'
import { roundToNearest } from '../formulas/weight-rounding'
import { getMusclesForLift } from '../volume/muscle-mapper'
import { getPrimaryMusclesForSession } from '../adjustments/soreness-adjuster'
import { calculateSets } from './set-calculator'
import { generateWarmupSets } from './warmup-calculator'

export function enforceHardConstraints(output: JITOutput, input: JITInput): JITOutput {
  let { mainLiftSets, skippedMainLift, warnings } = output
  const newWarnings = [...warnings]

  // MRV cap — non-negotiable
  if (!skippedMainLift) {
    const primaryMuscles = getPrimaryMusclesForSession(input.primaryLift)
    const liftMuscles = getMusclesForLift(input.primaryLift)
    for (const { muscle } of liftMuscles) {
      if (!primaryMuscles.includes(muscle)) continue
      const weeklyVol = input.weeklyVolumeToDate[muscle] ?? 0
      const { mrv } = input.mrvMevConfig[muscle]
      if (weeklyVol >= mrv) {
        skippedMainLift = true
        mainLiftSets = []
        newWarnings.push(`[constraint] MRV exceeded for ${muscle} — main lift forced skip`)
        break
      }
    }
  }

  // Weight floor — guard against LLM hallucination
  if (!skippedMainLift && mainLiftSets.length > 0) {
    const baseSets = calculateSets(
      input.primaryLift,
      input.intensityType,
      input.blockNumber,
      input.oneRmKg,
      input.formulaConfig,
    )
    const baseWeight = baseSets[0]?.weight_kg ?? 0
    const floorWeight = roundToNearest(baseWeight * 0.40)
    mainLiftSets = mainLiftSets.map((s) => ({
      ...s,
      weight_kg: Math.max(s.weight_kg, floorWeight),
    }))
  }

  // Minimum sets — if not skipped, must have ≥1 working set
  if (!skippedMainLift && mainLiftSets.length === 0) {
    const baseSets = calculateSets(
      input.primaryLift,
      input.intensityType,
      input.blockNumber,
      input.oneRmKg,
      input.formulaConfig,
    )
    if (baseSets.length > 0) {
      mainLiftSets = [baseSets[0]]
      newWarnings.push('[constraint] Minimum 1 working set enforced')
    }
  }

  // Weight rounding — all weights to nearest 2.5kg
  mainLiftSets = mainLiftSets.map((s) => ({
    ...s,
    weight_kg: roundToNearest(s.weight_kg),
  }))

  // Warmup — always formula-generated from working weight
  let { warmupSets } = output
  if (mainLiftSets.length > 0 && !skippedMainLift) {
    warmupSets = generateWarmupSets(mainLiftSets[0].weight_kg, input.warmupConfig)
  } else {
    warmupSets = []
  }

  return {
    ...output,
    mainLiftSets,
    warmupSets,
    skippedMainLift,
    warnings: newWarnings,
  }
}
