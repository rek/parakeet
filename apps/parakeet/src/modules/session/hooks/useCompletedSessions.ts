import { useAuth } from '@modules/auth';
import { useQuery } from '@tanstack/react-query';

import { sessionQueries } from '../data/session.queries';

/**
 * Fetches completed sessions for the current user.
 */
export function useCompletedSessions(offset: number, limit: number) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery(
    sessionQueries.completed(user?.id, offset, limit)
  );

  return { sessions: data, isLoading };
}
