import {
  ActualSetSchema,
  AdjustmentSuggestionSchema,
  FormulaOverridesSchema,
  PlannedSetSchema,
} from '@parakeet/shared-types'
import type {
  ActualSet,
  AdjustmentSuggestion,
  FormulaOverrides,
  PlannedSet,
} from '@parakeet/shared-types'

export function parsePlannedSetsJson(value: unknown): PlannedSet[] | null {
  if (value === null || value === undefined) return null
  if (!Array.isArray(value)) {
    throw new Error('planned_sets must be an array or null')
  }
  return value.map((item) => PlannedSetSchema.parse(item))
}

export function parseActualSetsJson(value: unknown): ActualSet[] {
  if (!Array.isArray(value)) {
    throw new Error('actual_sets must be an array')
  }
  return value.map((item) => ActualSetSchema.parse(item))
}

export function parseFormulaOverridesJson(value: unknown): FormulaOverrides {
  return FormulaOverridesSchema.parse(value)
}

export function parseAdjustmentSuggestionsJson(value: unknown): AdjustmentSuggestion[] {
  if (!Array.isArray(value)) {
    throw new Error('adjustment_suggestions must be an array')
  }
  return value.map((item) => AdjustmentSuggestionSchema.parse(item))
}
