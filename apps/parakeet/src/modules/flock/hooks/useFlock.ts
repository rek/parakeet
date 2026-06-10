// @spec docs/features/flock/spec-ui.md
import { useAuth } from '@modules/auth';
import { useQuery } from '@tanstack/react-query';

import { flockQueries } from '../data/flock.queries';

/** The list of other lifters' highlight cards (sharers only). */
export function useFlock() {
  const { user } = useAuth();
  return useQuery(flockQueries.highlights(user?.id));
}
