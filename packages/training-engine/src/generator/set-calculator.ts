import { IntensityType, Lift, PlannedSet } from '@parakeet/shared-types'
import { InvalidInputError } from '../errors'
import { roundToNearest } from '../formulas/weight-rounding'
import { BlockConfig, FormulaConfig, FormulaConfigOverrides } from '../types'

export function calculateSets(
  _lift: Lift,
  intensityType: IntensityType,
  blockNumber: 1 | 2 | 3,
  oneRmKg: number,
  formulaConfig: FormulaConfig,
): PlannedSet[] {
  const increment = formulaConfig.rounding_increment_kg

  if (intensityType === 'deload') {
    const { pct, sets, reps, rpe_target } = formulaConfig.deload
    const weightKg = roundToNearest(pct * oneRmKg, increment)
    return Array.from({ length: sets }, (_, i) => ({
      set_number: i + 1,
      weight_kg: weightKg,
      reps,
      rpe_target,
    }))
  }

  const block = formulaConfig[`block${blockNumber}`] as BlockConfig

  if (intensityType === 'heavy' || intensityType === 'explosive') {
    const config = block[intensityType]
    const weightKg = roundToNearest(config.pct * oneRmKg, increment)
    return Array.from({ length: config.sets }, (_, i) => {
      const set: PlannedSet = {
        set_number: i + 1,
        weight_kg: weightKg,
        reps: config.reps,
        rpe_target: config.rpe_target,
      }
      if (config.reps_max !== undefined && config.reps_max > config.reps) {
        set.reps_range = [config.reps, config.reps_max]
      }
      return set
    })
  }

  if (intensityType === 'rep') {
    const config = block.rep
    const weightKg = roundToNearest(config.pct * oneRmKg, increment)
    const sets = Math.round((config.sets_min + config.sets_max) / 2)
    return Array.from({ length: sets }, (_, i) => ({
      set_number: i + 1,
      weight_kg: weightKg,
      reps: config.reps_min,
      rpe_target: config.rpe_target,
      reps_range: [config.reps_min, config.reps_max] as [number, number],
    }))
  }

  throw new InvalidInputError(`Unknown intensity type: ${intensityType}`)
}

function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target }
  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceVal = source[key]
    const targetVal = target[key]
    if (
      sourceVal !== null &&
      sourceVal !== undefined &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === 'object' &&
      targetVal !== null
    ) {
      result[key] = deepMerge(targetVal as object, sourceVal as object) as T[keyof T]
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal as T[keyof T]
    }
  }
  return result
}

// Local alias for the recursive partial used in deepMerge
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

export function mergeFormulaConfig(
  systemDefaults: FormulaConfig,
  userOverrides: FormulaConfigOverrides,
): FormulaConfig {
  return deepMerge(systemDefaults, userOverrides)
}
