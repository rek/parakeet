// @spec docs/features/disruptions/spec-adjuster.md
import { safeParseJsonArray, safeParseNullableJsonArray } from '@parakeet/db';
import {
  AdjustmentSuggestionSchema,
  PlannedSetSchema,
} from '@parakeet/shared-types';
import type { AdjustmentSuggestion, PlannedSet } from '@parakeet/shared-types';
import { captureException } from '@platform/utils/captureException';

export function parsePlannedSetsJson(value: unknown): PlannedSet[] | null {
  return safeParseNullableJsonArray(
    value,
    'planned_sets',
    (item) => PlannedSetSchema.parse(item),
    captureException
  );
}

export function parseAdjustmentSuggestionsJson(
  value: unknown
): AdjustmentSuggestion[] {
  return safeParseJsonArray(
    value,
    'adjustment_suggestions',
    (item) => AdjustmentSuggestionSchema.parse(item),
    captureException
  );
}
