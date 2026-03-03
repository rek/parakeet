import {
  AdjustmentSuggestionSchema,
  PlannedSetSchema,
} from '@parakeet/shared-types'
import type {
  AdjustmentSuggestion,
  PlannedSet,
} from '@parakeet/shared-types'
import { parseJsonArray, parseNullableJsonArray } from '@parakeet/db'

export function parsePlannedSetsJson(value: unknown): PlannedSet[] | null {
  return parseNullableJsonArray(value, 'planned_sets', (item) => PlannedSetSchema.parse(item))
}

export function parseAdjustmentSuggestionsJson(value: unknown): AdjustmentSuggestion[] {
  return parseJsonArray(value, 'adjustment_suggestions', (item) =>
    AdjustmentSuggestionSchema.parse(item),
  )
}
