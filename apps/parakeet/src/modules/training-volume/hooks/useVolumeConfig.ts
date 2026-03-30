import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@modules/auth';
import { getProfile } from '@modules/profile';
import type { MuscleGroup } from '@parakeet/shared-types';

import {
  getMrvMevConfig,
  resetMuscleToDefault,
  updateMuscleConfig,
} from '../lib/volume-config';
import { volumeQueries } from '../data/volume.queries';

export function useVolumeConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: volumeConfigData, isLoading } = useQuery({
    queryKey: volumeQueries.config(user?.id),
    queryFn: async () => {
      const profile = await getProfile();
      const data = await getMrvMevConfig(user!.id, profile?.biological_sex);
      return { data, profile };
    },
    enabled: !!user?.id,
  });

  async function saveMuscleConfigs(
    drafts: Record<MuscleGroup, { mev: number; mrv: number }>
  ) {
    if (!user) return;
    const muscles = Object.keys(drafts) as MuscleGroup[];
    await Promise.all(muscles.map((m) => updateMuscleConfig(user.id, m, drafts[m])));
    queryClient.invalidateQueries({ queryKey: volumeQueries.all() });
  }

  async function resetAllMuscles(muscles: readonly MuscleGroup[]) {
    if (!user) return;
    await Promise.all(muscles.map((m) => resetMuscleToDefault(user.id, m)));
    queryClient.invalidateQueries({ queryKey: volumeQueries.all() });
  }

  return { volumeConfigData, isLoading, saveMuscleConfigs, resetAllMuscles };
}
