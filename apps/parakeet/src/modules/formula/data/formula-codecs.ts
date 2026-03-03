import { FormulaOverridesSchema } from '@parakeet/shared-types'
import type { FormulaOverrides } from '@parakeet/shared-types'
import { parseWithParser } from '@parakeet/db'

export function parseFormulaOverridesJson(value: unknown): FormulaOverrides {
  return parseWithParser(value, (v) => FormulaOverridesSchema.parse(v))
}
