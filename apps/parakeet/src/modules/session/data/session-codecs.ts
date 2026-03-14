import { parseJsonArray, parseNullableJsonArray } from '@parakeet/db';
import { ActualSetSchema, PlannedSetSchema } from '@parakeet/shared-types';
import type { ActualSet, PlannedSet } from '@parakeet/shared-types';

export function parseActualSetsJson(value: unknown): ActualSet[] {
  return parseJsonArray(value, 'actual_sets', (item) =>
    ActualSetSchema.parse(item)
  );
}

export function parsePlannedSetsJson(value: unknown): PlannedSet[] {
  return (
    parseNullableJsonArray(value, 'planned_sets', (item) =>
      PlannedSetSchema.parse(item)
    ) ?? []
  );
}
