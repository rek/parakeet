import { useQuery } from '@tanstack/react-query';

import { jitQueries } from '../data/jit.queries';

export function useChallengeReview(sessionId: string, enabled: boolean) {
  return useQuery({
    ...jitQueries.challengeReview(sessionId),
    enabled,
    refetchInterval: (query) => (query.state.data ? false : 3000),
    retry: 10,
    staleTime: Infinity,
  });
}
