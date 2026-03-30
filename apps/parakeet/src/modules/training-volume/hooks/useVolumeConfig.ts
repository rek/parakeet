import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@modules/auth';
import { typedSupabase } from '@platform/supabase';
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
      // Inline profile fetch to avoid circular dependency on @modules/profile
      const { data: profile } = await typedSupabase
        .from('profiles')
        .select('biological_sex')
        .eq('id', user!.id)
        .single();
      const sex = profile?.biological_sex as 'female' | 'male' | null;
      const data = await getMrvMevConfig(user!.id, sex);
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
