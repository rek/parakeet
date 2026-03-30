import { queryOptions, skipToken } from '@tanstack/react-query';
import type { Lift } from '@parakeet/shared-types';

import {
  getPerformanceByLift,
  getPerformanceTrends,
  getRecentLiftHistory,
} from '../lib/performance';

export const historyQueries = {
  all: () => ['performance'] as const,

  trends: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...historyQueries.all(), 'trends', userId] as const,
      queryFn: userId ? () => getPerformanceTrends(userId) : skipToken,
    }),

  liftHistory: (userId: string | undefined, lift: string) =>
    queryOptions({
      queryKey: ['liftHistory', userId, lift] as const,
      queryFn:
        userId && lift
          ? () => getRecentLiftHistory(userId, lift as Lift)
          : skipToken,
    }),

  liftDetail: (userId: string | undefined, lift: string) =>
    queryOptions({
      queryKey: [...historyQueries.all(), 'lift', lift, userId] as const,
      queryFn:
        userId && lift
          ? () => getPerformanceByLift(userId, lift as Lift)
          : skipToken,
    }),
};
