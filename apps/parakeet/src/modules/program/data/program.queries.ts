import { queryOptions, skipToken } from '@tanstack/react-query';

import { getActiveProgram } from '../application/program.service';

export const programQueries = {
  all: () => ['program'] as const,

  active: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...programQueries.all(), 'active', userId] as const,
      queryFn: userId ? () => getActiveProgram(userId) : skipToken,
    }),
};
