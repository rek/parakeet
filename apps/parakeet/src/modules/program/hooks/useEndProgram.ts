import { useAuth } from '@modules/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateProgramStatus } from '../application/program.service';
import { programQueries } from '../data/program.queries';

export function useEndProgram({ isUnending }: { isUnending: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { mutate: endProgram, isPending } = useMutation({
    mutationFn: (programId: string) =>
      updateProgramStatus(programId, 'archived', {
        triggerCycleReview: isUnending,
        userId: user?.id,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: programQueries.active(user?.id).queryKey,
      }),
  });

  return { endProgram, isPending };
}
