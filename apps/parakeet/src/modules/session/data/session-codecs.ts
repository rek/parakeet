import { ActualSetSchema } from '@parakeet/shared-types'
import type { ActualSet } from '@parakeet/shared-types'
import { parseJsonArray } from '@parakeet/db'

export function parseActualSetsJson(value: unknown): ActualSet[] {
  return parseJsonArray(value, 'actual_sets', (item) => ActualSetSchema.parse(item))
}
