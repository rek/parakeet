import { queryOptions, skipToken } from '@tanstack/react-query';

import { getWeeklyBodyReviews } from '../application/body-review.service';

export const bodyReviewQueries = {
  all: () => ['weekly-body-reviews'] as const,

  list: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...bodyReviewQueries.all(), userId] as const,
      queryFn: userId ? () => getWeeklyBodyReviews(userId) : skipToken,
    }),

  byWeek: (
    userId: string | undefined,
    programId: string | undefined,
    weekNumber: number | undefined
  ) => ['weekly-body-review', userId, programId, weekNumber] as const,
};
