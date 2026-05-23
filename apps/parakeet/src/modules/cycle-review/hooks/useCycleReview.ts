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

// When a pending row exists in the DB the LLM call is presumed in-flight —
// give it a full 60s before showing retry. When no row exists at all, the
// auto-trigger has likely not fired (or failed), so the user shouldn't have
// to wait the full 60s before being able to manually generate.
const RETRY_SHOW_DELAY_PENDING_MS = 60_000;
const RETRY_SHOW_DELAY_NO_ROW_MS = 25_000;
const MAX_RETRY_ATTEMPTS = 3;

export function useCycleReview(programId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const retryCount = useRef(0);
  const [showRetry, setShowRetry] = useState(false);

  const query = useQuery({
    ...cycleReviewQueries.byProgram(programId, user?.id),
    // Poll every 10s until complete or errored. 'error' rows are terminal so
    // we stop polling and let the user retry manually.
    refetchInterval: (q) =>
      q.state.data?.status === 'complete' ||
      q.state.data?.status === 'error' ||
      q.state.error
        ? false
        : 10_000,
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
  // Behaviour:
  //  - 'error' row: show immediately (LLM failed; user should retry now).
  //  - 'pending' row: wait the full 60s (generation in flight).
  //  - no row at all (null): wait 25s — auto-trigger should have written a row
  //    by then; if it hasn't, surfacing a manual button is friendlier than the
  //    old 60s wait for a flow that's already gone wrong.
  useEffect(() => {
    const status = query.data?.status;
    const hasComplete = status === 'complete';
    if (hasComplete || retryCount.current >= MAX_RETRY_ATTEMPTS) return;
    if (status === 'error') {
      setShowRetry(true);
      return;
    }
    const delay =
      status === 'pending'
        ? RETRY_SHOW_DELAY_PENDING_MS
        : RETRY_SHOW_DELAY_NO_ROW_MS;
    const timer = setTimeout(() => setShowRetry(true), delay);
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
  const reviewErrored = query.data?.status === 'error';
  const errorMessage = query.data?.errorMessage ?? null;

  return {
    ...query,
    data: query.data?.review ?? null,
    reviewPending,
    reviewErrored,
    errorMessage,
    showRetry: showRetry && canRetry,
    triggerReview: () => triggerMutation.mutate(),
    isTriggeringReview: triggerMutation.isPending,
    triggerError: triggerMutation.error,
  };
}
