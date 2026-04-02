import { queryOptions, skipToken } from '@tanstack/react-query';

import { getCurrentCycleContext, getCycleConfig } from '../lib/cycle-tracking';

export const cycleTrackingQueries = {
  all: () => ['cycle'] as const,

  phase: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...cycleTrackingQueries.all(), 'phase', userId] as const,
      queryFn: userId ? () => getCurrentCycleContext(userId) : skipToken,
    }),

  config: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...cycleTrackingQueries.all(), 'config', userId] as const,
      queryFn: userId ? () => getCycleConfig(userId) : skipToken,
    }),
};
