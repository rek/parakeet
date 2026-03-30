import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@modules/auth';

import { historyQueries } from '../data/history.queries';

export function useLiftDetail({ lift }: { lift: string }) {
  const { user } = useAuth();

  const liftDataQuery = useQuery(historyQueries.liftDetail(user?.id, lift));

  const trendsQuery = useQuery({
    ...historyQueries.trends(user?.id),
    staleTime: 60_000,
  });

  const isLoading = liftDataQuery.isLoading;

  return {
    liftData: liftDataQuery.data,
    trends: trendsQuery.data,
    isLoading,
  };
}
