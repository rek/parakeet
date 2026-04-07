import { useAuth } from '@modules/auth';
import { queryOptions, skipToken, useQuery } from '@tanstack/react-query';

import {
  getCompletedSessions,
  listPrograms,
} from '../application/history-screen.service';
import { historyQueries } from '../data/history.queries';

export function useHistoryScreen(weeks: number) {
  const { user } = useAuth();

  const trendsQuery = useQuery({
    ...historyQueries.trends(user?.id),
    enabled: !!user?.id,
  });

  // SYNC: Mirrors sessionQueries.completed(userId, 0, 20) from @modules/session.
  // Inlined to avoid circular dependency: history -> session -> history.
  const sessionsQuery = useQuery(
    queryOptions({
      queryKey: ['session', 'completed', user?.id, 0, 20] as const,
      queryFn: user?.id ? () => getCompletedSessions(user.id, 0, 20) : skipToken,
    })
  );

  // SYNC: Mirrors programQueries.inactive(userId) from @modules/program.
  // Inlined to avoid circular dependency: history -> program -> history.
  const programsQuery = useQuery(
    queryOptions({
      queryKey: ['program', 'inactive', user?.id] as const,
      queryFn: user?.id
        ? async () => {
            const all = await listPrograms(user.id);
            return all.filter((p) => p.status !== 'active');
          }
        : skipToken,
    })
  );

  const volumeQuery = useQuery(historyQueries.weeklySetsPerLift(user?.id, weeks));
  const volumeKgQuery = useQuery(historyQueries.weeklyVolumeKg(user?.id, weeks));

  const isLoading = trendsQuery.isLoading || sessionsQuery.isLoading;

  return {
    trends: trendsQuery.data,
    sessions: sessionsQuery.data,
    programs: programsQuery.data,
    volume: volumeQuery.data,
    volumeLoading: volumeQuery.isLoading,
    volumeKg: volumeKgQuery.data,
    volumeKgLoading: volumeKgQuery.isLoading,
    isLoading,
  };
}
