import type { Lift } from '@parakeet/shared-types';
import { queryOptions, skipToken } from '@tanstack/react-query';

import { getActiveProgram, listPrograms } from '../application/program.service';
import { getCurrentOneRmKg } from '../lib/lifter-maxes';

export const programQueries = {
  all: () => ['program'] as const,

  active: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...programQueries.all(), 'active', userId] as const,
      queryFn: userId ? () => getActiveProgram(userId) : skipToken,
    }),

  inactive: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...programQueries.all(), 'inactive', userId] as const,
      queryFn: userId
        ? async () => {
            const all = await listPrograms(userId);
            return all.filter((p) => p.status !== 'active');
          }
        : skipToken,
    }),

  maxes: {
    all: () => ['maxes'] as const,

    byLift: (userId: string | undefined, lift: Lift | string | undefined) =>
      queryOptions({
        queryKey: ['maxes', userId, lift, '1rm'] as const,
        queryFn:
          userId && lift
            ? () => getCurrentOneRmKg(userId, lift as Lift)
            : skipToken,
      }),

    combined: (userId: string | undefined) =>
      queryOptions({
        queryKey: ['maxes', 'all', userId] as const,
        queryFn: userId
          ? async () => {
              const [squat, bench, deadlift] = await Promise.all([
                getCurrentOneRmKg(userId, 'squat'),
                getCurrentOneRmKg(userId, 'bench'),
                getCurrentOneRmKg(userId, 'deadlift'),
              ]);
              return {
                squat: squat ?? 0,
                bench: bench ?? 0,
                deadlift: deadlift ?? 0,
              };
            }
          : skipToken,
      }),
  },
};
