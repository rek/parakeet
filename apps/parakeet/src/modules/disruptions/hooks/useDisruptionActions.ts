import { useAuth } from '@modules/auth';
import { programQueries } from '@modules/program';
import { sessionQueries } from '@modules/session';
import { useQueryClient } from '@tanstack/react-query';

import { disruptionQueries } from '../data/disruptions.queries';

/**
 * Provides invalidation helpers for post-disruption cache updates.
 *
 * `invalidateAfterReport` — call after reportDisruption completes; refreshes
 * the active disruptions list so banners update immediately.
 *
 * `invalidateAfterAdjustment` — call after applyDisruptionAdjustment; refreshes
 * disruptions, the active program, and all sessions so the updated plan is shown.
 */
export function useDisruptionActions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  function invalidateAfterReport() {
    void queryClient.invalidateQueries({
      queryKey: disruptionQueries.active(user?.id).queryKey,
    });
  }

  function invalidateAfterAdjustment() {
    void queryClient.invalidateQueries({
      queryKey: disruptionQueries.active(user?.id).queryKey,
    });
    void queryClient.invalidateQueries({
      queryKey: programQueries.active(user?.id).queryKey,
    });
    void queryClient.invalidateQueries({
      queryKey: sessionQueries.all(),
    });
  }

  return { invalidateAfterReport, invalidateAfterAdjustment };
}
