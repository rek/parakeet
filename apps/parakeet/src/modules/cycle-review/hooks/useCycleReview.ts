import { useEffect } from 'react';

import { useAuth } from '@modules/auth';
import { qk } from '@platform/query';
import { captureException } from '@platform/utils/captureException';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getCycleReview,
  onCycleReviewInserted,
  triggerCycleReview,
} from '../application/cycle-review.service';

export function useCycleReview(programId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: qk.cycleReview.byProgram(programId, user?.id),
    queryFn: () => getCycleReview(programId, user!.id),
    enabled: !!user?.id && !!programId,
    // Poll every 10s until data arrives. Stop polling once data or error received.
    refetchInterval: (query) =>
      query.state.data || query.state.error ? false : 10_000,
  });

  const triggerMutation = useMutation({
    mutationFn: () => triggerCycleReview(programId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.cycleReview.byProgramPrefix(programId),
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
        queryKey: qk.cycleReview.byProgramPrefix(programId),
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
