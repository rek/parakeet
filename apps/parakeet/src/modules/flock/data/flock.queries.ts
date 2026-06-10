// @spec docs/features/flock/spec-data-foundation.md
import { queryOptions, skipToken } from '@tanstack/react-query';

import { fetchFlockHighlights, getFlockSharing } from './flock.repository';

export const flockQueries = {
  all: () => ['flock'] as const,

  highlights: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...flockQueries.all(), 'highlights', userId] as const,
      queryFn: userId ? () => fetchFlockHighlights(userId) : skipToken,
      staleTime: 5 * 60 * 1000,
    }),

  sharing: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...flockQueries.all(), 'sharing', userId] as const,
      queryFn: userId ? () => getFlockSharing(userId) : skipToken,
      staleTime: 5 * 60 * 1000,
    }),
};
