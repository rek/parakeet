// @spec docs/features/jit-pipeline/spec-generator.md
import { queryOptions } from '@tanstack/react-query';

import { fetchChallengeReview } from './jit.repository';

export const jitQueries = {
  all: () => ['jit'] as const,

  challengeReview: (sessionId: string) =>
    queryOptions({
      queryKey: ['challenge_review', sessionId] as const,
      queryFn: () => fetchChallengeReview(sessionId),
    }),
};
