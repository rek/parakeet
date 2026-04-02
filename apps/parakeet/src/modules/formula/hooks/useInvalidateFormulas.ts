import { useQueryClient } from '@tanstack/react-query';

import { formulaQueries } from '../data/formula.queries';

/**
 * Returns a stable callback that invalidates all formula queries.
 *
 * Used by screens outside the formula module (e.g. cycle-review) that need to
 * bust the cache after accepting a formula suggestion without pulling in the
 * full useFormulaEditor hook.
 */
export function useInvalidateFormulas() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: formulaQueries.all() });
}
