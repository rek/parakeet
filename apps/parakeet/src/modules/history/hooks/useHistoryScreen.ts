import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@modules/auth';
import { programQueries } from '@modules/program';
import { sessionQueries } from '@modules/session';

import { historyQueries } from '../data/history.queries';

export function useHistoryScreen() {
  const { user } = useAuth();

  const trendsQuery = useQuery({
    ...historyQueries.trends(user?.id),
    enabled: !!user?.id,
  });

  const sessionsQuery = useQuery(sessionQueries.completed(user?.id, 0, 20));

  const programsQuery = useQuery(programQueries.inactive(user?.id));

  const volumeQuery = useQuery(historyQueries.weeklySetsPerLift(user?.id, 8));

  const isLoading = trendsQuery.isLoading || sessionsQuery.isLoading;

  return {
    trends: trendsQuery.data,
    sessions: sessionsQuery.data,
    programs: programsQuery.data,
    volume: volumeQuery.data,
    volumeLoading: volumeQuery.isLoading,
    isLoading,
  };
}
