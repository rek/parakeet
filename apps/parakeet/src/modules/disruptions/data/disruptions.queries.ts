import { queryOptions, skipToken } from '@tanstack/react-query';

import { getActiveDisruptions } from '../lib/disruptions';

export const disruptionQueries = {
  all: () => ['disruptions'] as const,

  active: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...disruptionQueries.all(), 'active', userId] as const,
      queryFn: userId ? () => getActiveDisruptions(userId) : skipToken,
    }),
};
