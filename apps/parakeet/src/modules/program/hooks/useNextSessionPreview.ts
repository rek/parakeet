// @spec docs/features/programs/spec-unending.md
import { useAuth } from '@modules/auth';
import { historyQueries } from '@modules/history';
import type { Lift } from '@parakeet/shared-types';
import { queryOptions, skipToken, useQuery } from '@tanstack/react-query';

import { fetchActiveFormulaConfig } from '../data/program.repository';
import { programQueries } from '../data/program.queries';

// SYNC: query key matches formulaQueries.config() in @modules/formula so they
// share the React Query cache. formula ↔ program require cycle prevents importing
// @modules/formula here directly.
const formulaConfigQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ['formula', 'config', userId] as const,
    queryFn: userId ? () => fetchActiveFormulaConfig(userId) : skipToken,
  });

export function useNextSessionPreview({
  enabled,
  nextLift,
}: {
  enabled: boolean;
  nextLift: Lift | undefined;
}) {
  const { user } = useAuth();

  const { data: oneRmKg } = useQuery({
    ...programQueries.maxes.byLift(user?.id, nextLift),
    enabled: enabled && !!user?.id && !!nextLift,
    staleTime: 60_000,
  });

  const { data: formulaConfig } = useQuery({
    ...formulaConfigQuery(user?.id),
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
  });

  const { data: liftHistory } = useQuery({
    ...historyQueries.liftHistoryPreview(user?.id, nextLift),
    enabled: enabled && !!user?.id && !!nextLift,
    staleTime: 60_000,
  });

  return { oneRmKg, formulaConfig, liftHistory };
}
