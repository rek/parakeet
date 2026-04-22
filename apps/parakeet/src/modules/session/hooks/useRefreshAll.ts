// @spec docs/features/session/spec-set-persistence.md
import { useQueryClient } from '@tanstack/react-query';

/**
 * Returns a `refreshAll` function that invalidates every cached query.
 *
 * Intended for pull-to-refresh at the screen level — this is the one
 * legitimate use of `queryClient.invalidateQueries()` with no args, since
 * the Today screen is a composition root that owns all visible data.
 */
export function useRefreshAll() {
  const queryClient = useQueryClient();

  async function refreshAll() {
    await queryClient.invalidateQueries();
  }

  return { refreshAll };
}
