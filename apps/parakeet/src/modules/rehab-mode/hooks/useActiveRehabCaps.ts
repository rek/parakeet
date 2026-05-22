// @spec docs/features/rehab-mode/spec-app.md
import { useAuth } from '@modules/auth';
import type { Lift } from '@parakeet/shared-types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { rehabModeQueries } from '../data/rehab-mode.queries';

/**
 * Fetches all active rehab caps for the current user. Returns `RehabCapRow[]`
 * (empty array when no caps are active). Drives the Today-screen chip row.
 */
export function useActiveRehabCaps() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery(rehabModeQueries.activeCaps(user?.id));

  function invalidateActiveRehabCaps() {
    void queryClient.invalidateQueries({
      queryKey: rehabModeQueries.activeCaps(user?.id).queryKey,
    });
  }

  return { ...query, invalidateActiveRehabCaps };
}

/**
 * Fetches the active rehab cap (if any) for a specific lift. Drives per-lift
 * UI affordances — the pain-limited RPE pill, the capped-weight footnote.
 */
export function useRehabCapForLift(lift: Lift) {
  const { user } = useAuth();
  return useQuery(rehabModeQueries.activeForLift(user?.id, lift));
}
