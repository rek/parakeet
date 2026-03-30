import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@modules/auth';

import {
  addPeriodStart,
  deletePeriodStart,
  updateCycleConfig,
} from '../lib/cycle-tracking';
import { cycleTrackingQueries } from '../data/cycle-tracking.queries';

export function useCycleTrackingSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  function invalidateAll() {
    if (!user?.id) return;
    queryClient.invalidateQueries({
      queryKey: cycleTrackingQueries.phase(user.id).queryKey,
    });
    queryClient.invalidateQueries({
      queryKey: cycleTrackingQueries.config(user.id).queryKey,
    });
  }

  async function saveConfig(update: Parameters<typeof updateCycleConfig>[1]) {
    if (!user?.id) return;
    await updateCycleConfig(user.id, update);
    invalidateAll();
  }

  async function addPeriod(isoDate: string) {
    if (!user?.id) return null;
    const updated = await addPeriodStart(user.id, isoDate);
    invalidateAll();
    return updated;
  }

  async function deletePeriod(entryId: string) {
    if (!user?.id) return null;
    const updated = await deletePeriodStart(user.id, entryId);
    invalidateAll();
    return updated;
  }

  return { saveConfig, addPeriod, deletePeriod };
}
