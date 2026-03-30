import { useAuth } from '@modules/auth';
import { formulaQueries } from '@modules/formula';
import { historyQueries } from '@modules/history';
import type { Lift } from '@parakeet/shared-types';
import { useQuery } from '@tanstack/react-query';

import { programQueries } from '../data/program.queries';

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
    ...formulaQueries.config(user?.id),
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
