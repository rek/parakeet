import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@modules/auth';
import { programQueries } from '@modules/program';

import {
  createFormulaOverride,
  deactivateFormulaConfig,
} from '../application/formula.service';
import { formulaQueries } from '../data/formula.queries';

type TopTab = 'editor' | 'history' | 'suggestions';

export function useFormulaEditor({ topTab }: { topTab: TopTab }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    ...formulaQueries.config(user?.id),
    enabled: !!user?.id,
  });

  const historyQuery = useQuery({
    ...formulaQueries.history(user?.id),
    enabled: !!user?.id && topTab === 'history',
  });

  const suggestionsQuery = useQuery({
    ...formulaQueries.suggestions(user?.id),
    enabled: !!user?.id && topTab === 'suggestions',
  });

  const { data: oneRmKg = 0 } = useQuery({
    ...programQueries.maxes.byLift(user?.id, 'squat'),
    select: (v) => v ?? 0,
  });

  const activeProgramQuery = useQuery({
    ...programQueries.active(user?.id),
    enabled: !!user?.id,
  });

  const invalidateFormulas = () =>
    queryClient.invalidateQueries({ queryKey: formulaQueries.all() });

  const saveOverrideMutation = useMutation({
    mutationFn: ({
      overrides,
      source,
      ai_rationale,
    }: {
      overrides: unknown;
      source: 'user' | 'ai_suggestion';
      ai_rationale?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      return createFormulaOverride(user.id, { overrides, source, ai_rationale });
    },
    onSuccess: invalidateFormulas,
  });

  const acceptSuggestionMutation = useMutation({
    mutationFn: ({ overrides }: { overrides: unknown }) => {
      if (!user) throw new Error('Not authenticated');
      return createFormulaOverride(user.id, {
        overrides,
        source: 'ai_suggestion',
      });
    },
    onSuccess: invalidateFormulas,
  });

  const dismissSuggestionMutation = useMutation({
    mutationFn: ({ suggestionId }: { suggestionId: string }) => {
      if (!user) throw new Error('Not authenticated');
      return deactivateFormulaConfig(suggestionId, user.id);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: formulaQueries.suggestions(user?.id).queryKey,
      }),
  });

  const reactivateMutation = useMutation({
    mutationFn: ({ overrides }: { overrides: unknown }) => {
      if (!user) throw new Error('Not authenticated');
      return createFormulaOverride(user.id, { overrides, source: 'user' });
    },
    onSuccess: invalidateFormulas,
  });

  return {
    userId: user?.id,
    config: configQuery.data,
    configLoading: configQuery.isLoading,
    history: historyQuery.data,
    aiSuggestions: suggestionsQuery.data,
    oneRmKg,
    activeProgram: activeProgramQuery.data,
    saveOverride: saveOverrideMutation.mutateAsync,
    acceptSuggestion: acceptSuggestionMutation.mutateAsync,
    dismissSuggestion: dismissSuggestionMutation.mutateAsync,
    reactivate: reactivateMutation.mutateAsync,
    invalidateFormulas,
  };
}
