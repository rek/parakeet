// @spec docs/features/session/spec-today.md
import { useAuth } from '@modules/auth';
import { useQuery } from '@tanstack/react-query';

import { sessionQueries } from '../data/session.queries';

export function useTodaySession() {
  const { user } = useAuth();
  return useQuery({
    ...sessionQueries.today(user?.id),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useTodaySessions() {
  const { user } = useAuth();
  return useQuery({
    ...sessionQueries.todayAll(user?.id),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}
