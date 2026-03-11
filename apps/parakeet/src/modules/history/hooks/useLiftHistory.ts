import { useAuth } from '@modules/auth';
import type { Lift } from '@parakeet/shared-types';
import { useQuery } from '@tanstack/react-query';

import { getRecentLiftHistory } from '../lib/performance';

export function useLiftHistory(lift: string, enabled: boolean) {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['liftHistory', user?.id, lift],
    queryFn: () => getRecentLiftHistory(user!.id, lift as Lift),
    enabled: enabled && !!user?.id && !!lift,
    staleTime: 60_000,
  });

  return { data, isLoading, isError };
}
