// @spec docs/features/history/spec-history-screen.md
import { useAuth } from '@modules/auth';
import { useQuery } from '@tanstack/react-query';

import { historyQueries } from '../data/history.queries';

export function useLiftHistory(lift: string, enabled: boolean) {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    ...historyQueries.liftHistory(user?.id, lift),
    enabled: enabled && !!user?.id && !!lift,
    staleTime: 60_000,
  });

  return { data, isLoading, isError };
}
