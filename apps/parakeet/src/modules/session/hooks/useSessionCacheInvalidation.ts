// @spec docs/features/session/spec-set-persistence.md
import { volumeQueries } from '@modules/training-volume';
import { useQueryClient } from '@tanstack/react-query';

import { sessionQueries } from '../data/session.queries';

// SYNC: These root keys mirror the `all()` factories in each module's queries file.
// Inlined here to avoid circular dependencies between session <-> achievements,
// session <-> history, and session <-> program.
// Keep in sync with: achievementQueries.all(), historyQueries.all(), programQueries.all()
const ACHIEVEMENT_QUERY_KEY = ['achievements'] as const;
const HISTORY_QUERY_KEY = ['performance'] as const;
const PROGRAM_QUERY_KEY = ['program'] as const;

/**
 * Invalidates all caches that must be refreshed after a session is completed.
 *
 * Covers session list, history, achievements, weekly volume, and program state.
 */
export function useSessionCacheInvalidation() {
  const queryClient = useQueryClient();

  function invalidateAfterCompletion() {
    void queryClient.invalidateQueries({ queryKey: sessionQueries.all() });
    void queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ACHIEVEMENT_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: volumeQueries.all() });
    void queryClient.invalidateQueries({ queryKey: PROGRAM_QUERY_KEY });
  }

  return { invalidateAfterCompletion };
}
