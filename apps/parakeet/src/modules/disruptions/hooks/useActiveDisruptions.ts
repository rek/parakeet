// @spec docs/features/disruptions/spec-adjuster.md
import { useAuth } from '@modules/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { disruptionQueries } from '../data/disruptions.queries';

/**
 * Fetches active disruptions for the current user.
 *
 * Also exposes `invalidateDisruptions` so callers can invalidate the cache
 * after resolving or reporting a disruption without importing react-query.
 */
export function useActiveDisruptions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery(disruptionQueries.active(user?.id));

  function invalidateDisruptions() {
    void queryClient.invalidateQueries({
      queryKey: disruptionQueries.active(user?.id).queryKey,
    });
  }

  return { ...query, invalidateDisruptions };
}
