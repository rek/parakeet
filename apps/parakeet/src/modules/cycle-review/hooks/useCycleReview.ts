// @spec docs/features/cycle-review/spec-screen.md
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@modules/auth';
import type { CycleReview } from '@parakeet/shared-types';
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
    // Poll every 10s until complete review arrives. Keep polling if pending (may still be generating).
    refetchInterval: (q) =>
      q.state.data?.status === 'complete' || q.state.error ? false : 10_000,
  });

  const triggerMutation = useMutation<CycleReview, Error, void>({
    mutationFn: () => {
      retryCount.current += 1;
      return triggerCycleReview(programId, user!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: cycleReviewQueries.byProgramPrefix(programId),
      });
    },
    onError: (err) => captureException(err),
  });

  useEffect(() => {
    if (query.error) {
      captureException(query.error);
    }
  }, [query.error]);

  // Show retry button after delay when no complete review exists and budget remains.
  // If DB has a pending row (prior failure), show immediately without waiting.
  useEffect(() => {
    const hasComplete = query.data?.status === 'complete';
    if (hasComplete || retryCount.current >= MAX_RETRY_ATTEMPTS) return;
    if (query.data?.status === 'pending') {
      setShowRetry(true);
      return;
    }
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
  const reviewPending = query.data?.status === 'pending';

  return {
    ...query,
    data: query.data?.review ?? null,
    reviewPending,
    showRetry: showRetry && canRetry,
    triggerReview: () => triggerMutation.mutate(),
    isTriggeringReview: triggerMutation.isPending,
    triggerError: triggerMutation.error,
  };
}
