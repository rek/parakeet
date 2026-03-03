import { getDefaultFormulaConfig, mergeFormulaConfig } from '@parakeet/training-engine';
import type { FormulaConfig } from '@parakeet/training-engine';

import {
  activateFormulaConfigById,
  deactivateActiveFormulaConfigs,
  deactivateFormulaConfigById,
  getActiveFormulaConfigRow,
  getMostRecentInactiveFormulaConfig,
  insertFormulaConfig,
  listFormulaConfigs,
  listPendingAiFormulaSuggestions,
} from '../data/formula.repository';
import { parseFormulaOverridesJson } from '../data/formula-codecs';

export async function getFormulaConfig(
  userId: string,
  biologicalSex?: 'female' | 'male',
): Promise<FormulaConfig> {
  const activeConfig = await getActiveFormulaConfigRow(userId);

  const base = getDefaultFormulaConfig(biologicalSex);
  return activeConfig
    ? mergeFormulaConfig(base, parseFormulaOverridesJson(activeConfig.overrides))
    : base;
}

export async function createFormulaOverride(
  userId: string,
  input: {
    overrides: unknown;
    source: 'user' | 'ai_suggestion';
    ai_rationale?: string;
  },
): Promise<void> {
  await deactivateActiveFormulaConfigs(userId);

  await insertFormulaConfig({
    user_id: userId,
    overrides: parseFormulaOverridesJson(input.overrides),
    source: input.source,
    ai_rationale: input.ai_rationale ?? null,
    is_active: true,
  });
}

export async function getFormulaHistory(userId: string) {
  return listFormulaConfigs(userId);
}

export async function getPendingAiFormulaSuggestions(userId: string) {
  return listPendingAiFormulaSuggestions(userId);
}

export async function deactivateFormulaConfig(configId: string, userId: string): Promise<void> {
  await deactivateFormulaConfigById(configId, userId);

  const previous = await getMostRecentInactiveFormulaConfig(userId);
  if (previous) {
    await activateFormulaConfigById(previous.id);
  }
}
