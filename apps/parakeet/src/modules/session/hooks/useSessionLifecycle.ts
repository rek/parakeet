// @spec docs/features/session/spec-lifecycle.md
import { useQueryClient } from '@tanstack/react-query';

import { sessionQueries } from '../data/session.queries';

/**
 * Provides session cache invalidation for intra-session lifecycle events
 * (start, abandon, resume).
 *
 * Keeps `useQueryClient` out of session screens.
 */
export function useSessionLifecycle() {
  const queryClient = useQueryClient();

  function invalidateSessionCache() {
    void queryClient.invalidateQueries({ queryKey: sessionQueries.all() });
  }

  return { invalidateSessionCache };
}
