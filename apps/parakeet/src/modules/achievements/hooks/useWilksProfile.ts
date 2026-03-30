import { useQuery } from '@tanstack/react-query';

import { achievementQueries } from '../data/achievements.queries';

export function useWilksProfile({ userId }: { userId: string | undefined }) {
  const historyQuery = useQuery(achievementQueries.wilksHistory(userId));
  const currentQuery = useQuery(achievementQueries.wilksCurrent(userId));

  const isLoading = historyQuery.isLoading || currentQuery.isLoading;

  return {
    history: historyQuery.data,
    current: currentQuery.data,
    isLoading,
  };
}
