// @spec docs/features/disruptions/spec-adjuster.md
import { queryOptions, skipToken } from '@tanstack/react-query';

import { fetchActiveDisruptions } from './disruptions.repository';

export const disruptionQueries = {
  all: () => ['disruptions'] as const,

  active: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...disruptionQueries.all(), 'active', userId] as const,
      queryFn: userId ? () => fetchActiveDisruptions(userId) : skipToken,
    }),
};
