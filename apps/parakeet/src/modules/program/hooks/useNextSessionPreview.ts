import { useAuth } from '@modules/auth';
import { historyQueries } from '@modules/history';
import { safeParseWithParser } from '@parakeet/db';
import type { Lift } from '@parakeet/shared-types';
import { FormulaOverridesSchema } from '@parakeet/shared-types';
import type { FormulaOverrides } from '@parakeet/shared-types';
import {
  getDefaultFormulaConfig,
  mergeFormulaConfig,
} from '@parakeet/training-engine';
import { typedSupabase } from '@platform/supabase';
import { captureException } from '@platform/utils/captureException';
import { queryOptions, skipToken, useQuery } from '@tanstack/react-query';

import { programQueries } from '../data/program.queries';

const EMPTY_OVERRIDES: FormulaOverrides = {} as FormulaOverrides;

// SYNC: Inline formula config query to avoid circular dependency on @modules/formula.
// Mirrors formulaQueries.config() in @modules/formula/data/formula.queries.ts.
// Same key ['formula', 'config', userId] so they share the React Query cache.
const formulaConfigQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ['formula', 'config', userId] as const,
    queryFn: userId
      ? async () => {
          const { data } = await typedSupabase
            .from('formula_configs')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true)
            .maybeSingle();
          const base = getDefaultFormulaConfig();
          if (!data) return base;
          const overrides = safeParseWithParser(
            data.overrides,
            (v) => FormulaOverridesSchema.parse(v),
            EMPTY_OVERRIDES,
            captureException,
          );
          return mergeFormulaConfig(base, overrides);
        }
      : skipToken,
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
