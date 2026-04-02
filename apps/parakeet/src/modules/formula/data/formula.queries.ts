import { queryOptions, skipToken } from '@tanstack/react-query';

import {
  getFormulaConfig,
  getFormulaHistory,
  getPendingAiFormulaSuggestions,
} from '../application/formula.service';

export const formulaQueries = {
  all: () => ['formula'] as const,

  // SYNC: query key duplicated in @modules/program/hooks/useNextSessionPreview.ts
  // to break a require cycle. Keep keys identical so they share the React Query cache.
  config: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...formulaQueries.all(), 'config', userId] as const,
      queryFn: userId ? () => getFormulaConfig(userId) : skipToken,
    }),

  history: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...formulaQueries.all(), 'history', userId] as const,
      queryFn: userId ? () => getFormulaHistory(userId) : skipToken,
    }),

  suggestions: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...formulaQueries.all(), 'suggestions', userId] as const,
      queryFn: userId
        ? () => getPendingAiFormulaSuggestions(userId)
        : skipToken,
    }),
};
