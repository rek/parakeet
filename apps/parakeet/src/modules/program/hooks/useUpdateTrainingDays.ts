import { useAuth } from '@modules/auth';
import { sessionQueries } from '@modules/session';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateTrainingDays } from '../application/program.service';
import { programQueries } from '../data/program.queries';

export function useUpdateTrainingDays() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { mutateAsync: updateDays, isPending } = useMutation({
    mutationFn: ({
      programId,
      newDays,
      program,
    }: {
      programId: string;
      newDays: number[];
      program: {
        program_mode: string;
        start_date: string;
        training_days: number[] | null;
      };
    }) => updateTrainingDays(programId, newDays, program),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: programQueries.active(user?.id).queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: sessionQueries.all(),
      });
    },
  });

  return { updateDays, isPending };
}
