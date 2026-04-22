import { useAuth } from '@modules/auth';
import type { MuscleGroup } from '@parakeet/shared-types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchBiologicalSexForVolume } from '../data/volume-config.repository';
import { volumeQueries } from '../data/volume.queries';
import {
  getMrvMevConfig,
  resetMuscleToDefault,
  updateMuscleConfig,
} from '../lib/volume-config';

export function useVolumeConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: volumeConfigData, isLoading } = useQuery({
    queryKey: volumeQueries.config(user?.id),
    queryFn: async () => {
      // Fetches sex from profiles via repo to avoid circular dep on @modules/profile
      const sex = await fetchBiologicalSexForVolume(user!.id);
      const data = await getMrvMevConfig(user!.id, sex);
      return { data, profile: { biological_sex: sex } };
    },
    enabled: !!user?.id,
  });

  async function saveMuscleConfigs(
    drafts: Record<MuscleGroup, { mev: number; mrv: number }>
  ) {
    if (!user) return;
    const muscles = Object.keys(drafts) as MuscleGroup[];
    await Promise.all(
      muscles.map((m) => updateMuscleConfig(user.id, m, drafts[m]))
    );
    queryClient.invalidateQueries({ queryKey: volumeQueries.all() });
  }

  async function resetAllMuscles(muscles: readonly MuscleGroup[]) {
    if (!user) return;
    await Promise.all(muscles.map((m) => resetMuscleToDefault(user.id, m)));
    queryClient.invalidateQueries({ queryKey: volumeQueries.all() });
  }

  return { volumeConfigData, isLoading, saveMuscleConfigs, resetAllMuscles };
}
