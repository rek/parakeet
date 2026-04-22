// @spec docs/features/cycle-review/spec-generator.md
import { queryOptions, skipToken } from '@tanstack/react-query';

import { getCycleReview } from '../application/cycle-review.service';

export const cycleReviewQueries = {
  all: () => ['cycle-review'] as const,

  // Key prefix for invalidating all queries for a given program (any user).
  byProgramPrefix: (programId: string) =>
    [...cycleReviewQueries.all(), programId] as const,

  byProgram: (programId: string, userId: string | undefined) =>
    queryOptions({
      queryKey: [...cycleReviewQueries.all(), programId, userId] as const,
      queryFn:
        userId && programId
          ? () => getCycleReview(programId, userId)
          : skipToken,
    }),
};
