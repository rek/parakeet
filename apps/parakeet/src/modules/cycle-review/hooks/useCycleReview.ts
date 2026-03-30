import { useEffect } from 'react';

import { useAuth } from '@modules/auth';
import { captureException } from '@platform/utils/captureException';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  onCycleReviewInserted,
  triggerCycleReview,
} from '../application/cycle-review.service';
import { cycleReviewQueries } from '../data/cycle-review.queries';

export function useCycleReview(programId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    ...cycleReviewQueries.byProgram(programId, user?.id),
    // Poll every 10s until data arrives. Stop polling once data or error received.
    refetchInterval: (query) =>
      query.state.data || query.state.error ? false : 10_000,
  });

  const triggerMutation = useMutation({
    mutationFn: () => triggerCycleReview(programId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: cycleReviewQueries.byProgramPrefix(programId),
      });
    },
    onError: captureException,
  });

  useEffect(() => {
    if (query.error) {
      captureException(query.error);
    }
  }, [query.error]);

  // Realtime subscription for instant update when row is inserted
  useEffect(() => {
    if (!programId || !user?.id) return;

    return onCycleReviewInserted(programId, () => {
      queryClient.invalidateQueries({
        queryKey: cycleReviewQueries.byProgramPrefix(programId),
      });
    });
  }, [programId, user?.id, queryClient]);

  return {
    ...query,
    triggerReview: triggerMutation.mutate,
    isTriggeringReview: triggerMutation.isPending,
    triggerError: triggerMutation.error,
  };
}
