import { queryOptions, skipToken } from '@tanstack/react-query';

import { getBodyweightHistory } from '../application/bodyweight.service';
import { getProfile } from '../application/profile.service';

export const profileQueries = {
  all: () => ['profile'] as const,

  current: () =>
    queryOptions({
      queryKey: profileQueries.all(),
      queryFn: getProfile,
    }),

  bodyweightHistory: (userId: string | undefined) =>
    queryOptions({
      queryKey: ['bodyweight', 'history', userId] as const,
      queryFn: userId ? () => getBodyweightHistory() : skipToken,
    }),
};
