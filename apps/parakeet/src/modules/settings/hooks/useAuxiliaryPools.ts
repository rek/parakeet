// @spec docs/features/settings-and-tools/spec-bar-weight.md
import { useAuth } from '@modules/auth';
import {
  getAllAuxMuscleMap,
  getAuxiliaryPools,
  reorderAuxiliaryPool,
} from '@modules/program';
import type { Lift, MuscleGroup } from '@parakeet/shared-types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { settingsQueries } from '../data/settings.queries';

export function useAuxiliaryPools() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: poolData, isLoading: isLoadingPools } = useQuery({
    queryKey: settingsQueries.auxiliary.pools(user?.id),
    queryFn: () => getAuxiliaryPools(user!.id),
    enabled: !!user?.id,
  });

  const { data: muscleMap, isLoading: isLoadingMuscles } = useQuery({
    queryKey: settingsQueries.auxiliary.muscles(user?.id),
    queryFn: () => getAllAuxMuscleMap(user!.id),
    enabled: !!user?.id,
  });

  async function saveAuxiliaryPool(
    lift: Lift,
    pool: string[],
    customMuscles?: Record<string, MuscleGroup[]>
  ) {
    if (!user) return;
    await reorderAuxiliaryPool(user.id, lift, pool, customMuscles);
    queryClient.invalidateQueries({
      queryKey: settingsQueries.auxiliary.all(),
    });
  }

  return {
    poolData,
    muscleMap: muscleMap ?? {},
    isLoading: isLoadingPools || isLoadingMuscles,
    saveAuxiliaryPool,
  };
}
