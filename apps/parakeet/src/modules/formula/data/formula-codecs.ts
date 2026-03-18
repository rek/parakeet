import { safeParseWithParser } from '@parakeet/db';
import { FormulaOverridesSchema } from '@parakeet/shared-types';
import type { FormulaOverrides } from '@parakeet/shared-types';
import { captureException } from '@platform/utils/captureException';

const EMPTY_OVERRIDES: FormulaOverrides = {} as FormulaOverrides;

export function parseFormulaOverridesJson(value: unknown): FormulaOverrides {
  return safeParseWithParser(
    value,
    (v) => FormulaOverridesSchema.parse(v),
    EMPTY_OVERRIDES,
    captureException
  );
}
