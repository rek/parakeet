import type { Lift } from '@parakeet/shared-types';
import { queryOptions, skipToken } from '@tanstack/react-query';

import {
  getPerformanceByLift,
  getPerformanceTrends,
  getRecentLiftHistory,
  getWeeklySetsPerLift,
  getWeeklyVolumeKg,
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

  liftHistoryPreview: (userId: string | undefined, lift: string | undefined) =>
    queryOptions({
      queryKey: ['liftHistory', userId, lift, 'preview'] as const,
      queryFn:
        userId && lift
          ? () => getRecentLiftHistory(userId, lift as Lift, 1)
          : skipToken,
    }),

  weeklySetsPerLift: (userId: string | undefined, weeks: number) =>
    queryOptions({
      queryKey: ['volume', 'weekly', userId, weeks] as const,
      queryFn: userId ? () => getWeeklySetsPerLift(userId, weeks) : skipToken,
    }),

  weeklyVolumeKg: (userId: string | undefined, weeks: number) =>
    queryOptions({
      queryKey: ['volume', 'weekly-kg', userId, weeks] as const,
      queryFn: userId ? () => getWeeklyVolumeKg(userId, weeks) : skipToken,
    }),
};
