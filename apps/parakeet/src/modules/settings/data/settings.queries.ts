// @spec docs/features/settings-and-tools/spec-bar-weight.md
import { queryOptions, skipToken } from '@tanstack/react-query';

import {
  getPendingFormulaSuggestionCount,
  getUnreviewedDeveloperSuggestionCount,
} from '../application/settings.service';
import { getDeveloperSuggestions } from '../lib/developer-suggestions';
import { getUserRestOverrides } from '../lib/rest-config';
import { getAllWarmupConfigs } from '../lib/warmup-config';

export const settingsQueries = {
  warmup: {
    all: () => ['warmup'] as const,
    configs: (userId: string | undefined) =>
      queryOptions({
        queryKey: ['warmup', 'configs', userId] as const,
        queryFn: userId ? () => getAllWarmupConfigs(userId) : skipToken,
      }),
  },

  auxiliary: {
    all: () => ['auxiliary'] as const,
    // pools queryFn lives in program module; key defined here for invalidation
    pools: (userId: string | undefined) =>
      ['auxiliary', 'pools', userId] as const,
    muscles: (userId: string | undefined) =>
      ['auxiliary', 'muscles', userId] as const,
  },

  rest: {
    all: () => ['rest', 'overrides'] as const,
    overrides: (userId: string | undefined) =>
      queryOptions({
        queryKey: ['rest', 'overrides', userId] as const,
        queryFn: userId ? () => getUserRestOverrides(userId) : skipToken,
      }),
  },

  formula: {
    all: () => ['formula'] as const,
    suggestionsCount: (userId: string | undefined) =>
      queryOptions({
        queryKey: ['formula', 'suggestions', 'count', userId] as const,
        queryFn: userId
          ? () => getPendingFormulaSuggestionCount(userId)
          : skipToken,
        staleTime: 60 * 1000,
      }),
  },

  developer: {
    all: () => ['developer', 'suggestions'] as const,
    suggestions: () =>
      queryOptions({
        queryKey: ['developer', 'suggestions'] as const,
        queryFn: getDeveloperSuggestions,
      }),
    suggestionsCount: () =>
      queryOptions({
        queryKey: ['developer', 'suggestions', 'count'] as const,
        queryFn: getUnreviewedDeveloperSuggestionCount,
        staleTime: 60 * 1000,
      }),
  },
};
