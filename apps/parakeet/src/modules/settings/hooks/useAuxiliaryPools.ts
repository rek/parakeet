import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@modules/auth';
import { getAuxiliaryPools, reorderAuxiliaryPool } from '@modules/program';
import type { Lift } from '@parakeet/shared-types';

import { settingsQueries } from '../data/settings.queries';

export function useAuxiliaryPools() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: poolData, isLoading } = useQuery({
    queryKey: settingsQueries.auxiliary.pools(user?.id),
    queryFn: () => getAuxiliaryPools(user!.id),
    enabled: !!user?.id,
  });

  async function saveAuxiliaryPool(lift: Lift, pool: string[]) {
    if (!user) return;
    await reorderAuxiliaryPool(user.id, lift, pool);
    queryClient.invalidateQueries({ queryKey: settingsQueries.auxiliary.all() });
  }

  return { poolData, isLoading, saveAuxiliaryPool };
}
