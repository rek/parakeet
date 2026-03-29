import { useAuth } from '@modules/auth';
import { qk } from '@platform/query';
import { useQuery } from '@tanstack/react-query';

import { getCurrentCycleContext } from '../lib/cycle-tracking';

export function useCyclePhase() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.cycle.phase(user?.id),
    queryFn: () => getCurrentCycleContext(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}
