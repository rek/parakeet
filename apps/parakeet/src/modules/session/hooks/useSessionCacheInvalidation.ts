import { achievementQueries } from '@modules/achievements';
import { historyQueries } from '@modules/history';
import { programQueries } from '@modules/program';
import { volumeQueries } from '@modules/training-volume';
import { useQueryClient } from '@tanstack/react-query';

import { sessionQueries } from '../data/session.queries';

/**
 * Invalidates all caches that must be refreshed after a session is completed.
 *
 * Covers session list, history, achievements, weekly volume, and program state.
 */
export function useSessionCacheInvalidation() {
  const queryClient = useQueryClient();

  function invalidateAfterCompletion() {
    void queryClient.invalidateQueries({ queryKey: sessionQueries.all() });
    void queryClient.invalidateQueries({ queryKey: historyQueries.all() });
    void queryClient.invalidateQueries({ queryKey: achievementQueries.all() });
    void queryClient.invalidateQueries({ queryKey: volumeQueries.all() });
    void queryClient.invalidateQueries({ queryKey: programQueries.all() });
  }

  return { invalidateAfterCompletion };
}
