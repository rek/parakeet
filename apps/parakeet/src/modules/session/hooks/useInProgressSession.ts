import { useAuth } from '@modules/auth';
import { useQuery } from '@tanstack/react-query';

import { sessionQueries } from '../data/session.queries';

export function useInProgressSession() {
  const { user } = useAuth();
  return useQuery({
    ...sessionQueries.inProgress(user?.id),
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });
}
