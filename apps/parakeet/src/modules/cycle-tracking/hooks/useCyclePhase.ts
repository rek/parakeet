import { useAuth } from '@modules/auth';
import { useQuery } from '@tanstack/react-query';

import { cycleTrackingQueries } from '../data/cycle-tracking.queries';

export function useCyclePhase() {
  const { user } = useAuth();
  return useQuery({
    ...cycleTrackingQueries.phase(user?.id),
    staleTime: 5 * 60 * 1000,
  });
}
