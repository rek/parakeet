import { useAuth } from '@modules/auth';
import { profileQueries } from '@modules/profile';
import { programQueries } from '@modules/program';
import type { Lift } from '@parakeet/shared-types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { settingsQueries } from '../data/settings.queries';
import { getAllWarmupConfigs, updateWarmupConfig } from '../lib/warmup-config';
import type { WarmupProtocol } from '../lib/warmup-config';

export function useWarmupProtocol() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    ...profileQueries.current(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: warmupData, isLoading } = useQuery({
    ...settingsQueries.warmup.configs(user?.id),
    queryFn: () =>
      getAllWarmupConfigs(user!.id, profile?.biological_sex ?? undefined),
    enabled: !!user?.id,
  });

  const { data: maxes } = useQuery({
    ...programQueries.maxes.combined(user?.id),
  });

  async function saveWarmupConfig(lift: Lift, protocol: WarmupProtocol) {
    if (!user) return;
    await updateWarmupConfig(user.id, lift, protocol);
    queryClient.invalidateQueries({ queryKey: settingsQueries.warmup.all() });
  }

  return { profile, warmupData, isLoading, maxes, saveWarmupConfig };
}
