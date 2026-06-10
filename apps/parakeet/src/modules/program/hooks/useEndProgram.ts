// @spec docs/features/programs/spec-generation-api.md
import { useAuth } from '@modules/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateProgramStatus } from '../application/program.service';
import { programQueries } from '../data/program.queries';

export function useEndProgram({
  isUnending: _isUnending,
}: {
  isUnending: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { mutate: endProgram, isPending } = useMutation({
    mutationFn: (programId: string) =>
      // Manual End Program should always trigger a cycle review — both scheduled
      // (partially completed) and unending programs need the post-mortem. The
      // isUnending arg is preserved for callsite compat but no longer gates.
      //
      // TODO(backlog): consider a MIN_SESSIONS_FOR_REVIEW floor (e.g. 5). A
      // user who abandons at 10% gets a thin LLM review at full cost.
      updateProgramStatus(programId, 'archived', {
        triggerCycleReview: true,
        userId: user?.id,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: programQueries.active(user?.id).queryKey,
      }),
  });

  return { endProgram, isPending };
}
