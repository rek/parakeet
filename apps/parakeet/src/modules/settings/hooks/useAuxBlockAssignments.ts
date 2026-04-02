import { useAuth } from '@modules/auth';
import { getAuxiliaryPools, programQueries } from '@modules/program';
import { useQuery } from '@tanstack/react-query';

import { settingsQueries } from '../data/settings.queries';

export function useAuxBlockAssignments() {
  const { user } = useAuth();

  const { data: activeProgram } = useQuery({
    ...programQueries.active(user?.id),
  });

  const { data: pools, isLoading: poolsLoading } = useQuery({
    queryKey: settingsQueries.auxiliary.pools(user?.id),
    queryFn: () => getAuxiliaryPools(user!.id),
    enabled: !!user?.id,
  });

  return { activeProgram, pools, poolsLoading };
}
