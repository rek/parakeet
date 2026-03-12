import { useQuery } from '@tanstack/react-query';

import { fetchChallengeReview } from '../data/jit.repository';

export function useChallengeReview(
  sessionId: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['challenge_review', sessionId],
    queryFn: () => fetchChallengeReview(sessionId),
    enabled,
    refetchInterval: (query) => (query.state.data ? false : 3000),
    retry: 10,
    staleTime: Infinity,
  });
}
