import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@modules/auth';
import { captureException } from '@platform/utils/captureException';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  onCycleReviewInserted,
  triggerCycleReview,
} from '../application/cycle-review.service';
import { cycleReviewQueries } from '../data/cycle-review.queries';

const RETRY_SHOW_DELAY_MS = 60_000;
const MAX_RETRY_ATTEMPTS = 3;

export function useCycleReview(programId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const retryCount = useRef(0);
  const [showRetry, setShowRetry] = useState(false);

  const query = useQuery({
    ...cycleReviewQueries.byProgram(programId, user?.id),
    // Poll every 10s until data arrives. Stop polling once data or error received.
    refetchInterval: (q) => (q.state.data || q.state.error ? false : 10_000),
  });

  const triggerMutation = useMutation({
    mutationFn: () => {
      retryCount.current += 1;
      return triggerCycleReview(programId, user!.id);
    },
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

  // Show retry button after delay only when no review exists and budget remains.
  useEffect(() => {
    if (query.data || retryCount.current >= MAX_RETRY_ATTEMPTS) return;
    const timer = setTimeout(() => setShowRetry(true), RETRY_SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  // Intentionally omits retryCount.current — ref changes don't re-run effects.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  // Realtime subscription for instant update when row is inserted
  useEffect(() => {
    if (!programId || !user?.id) return;

    return onCycleReviewInserted(programId, () => {
      queryClient.invalidateQueries({
        queryKey: cycleReviewQueries.byProgramPrefix(programId),
      });
    });
  }, [programId, user?.id, queryClient]);

  const canRetry = retryCount.current < MAX_RETRY_ATTEMPTS;

  return {
    ...query,
    showRetry: showRetry && canRetry,
    triggerReview: triggerMutation.mutate,
    isTriggeringReview: triggerMutation.isPending,
    triggerError: triggerMutation.error,
  };
}
