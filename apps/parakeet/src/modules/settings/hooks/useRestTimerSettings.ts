import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@modules/auth';
import type { IntensityType } from '@parakeet/shared-types';

import {
  getUserRestOverrides,
  resetRestOverrides,
  setRestOverride,
} from '../lib/rest-config';
import { settingsQueries } from '../data/settings.queries';

export function useRestTimerSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: overridesData, isLoading } = useQuery({
    ...settingsQueries.rest.overrides(user?.id),
    enabled: !!user?.id,
  });

  async function saveRestOverride(
    key: IntensityType | 'auxiliary',
    seconds: number
  ) {
    if (!user) return;
    if (key === 'auxiliary') {
      await setRestOverride(user.id, seconds, undefined, undefined);
    } else {
      await setRestOverride(user.id, seconds, undefined, key);
    }
    queryClient.invalidateQueries({ queryKey: settingsQueries.rest.all() });
  }

  async function resetOverrides() {
    if (!user) return;
    await resetRestOverrides(user.id);
    queryClient.invalidateQueries({ queryKey: settingsQueries.rest.all() });
  }

  return { overridesData, isLoading, saveRestOverride, resetOverrides };
}
