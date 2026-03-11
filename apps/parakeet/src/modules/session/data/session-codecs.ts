import { parseJsonArray } from '@parakeet/db';
import { ActualSetSchema } from '@parakeet/shared-types';
import type { ActualSet } from '@parakeet/shared-types';

export function parseActualSetsJson(value: unknown): ActualSet[] {
  return parseJsonArray(value, 'actual_sets', (item) =>
    ActualSetSchema.parse(item)
  );
}
