// @spec docs/features/programs/spec-generation-api.md
import { useAuth } from '@modules/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateTrainingDays } from '../application/program.service';
import { programQueries } from '../data/program.queries';

// SYNC: Mirrors sessionQueries.all() in @modules/session/data/session.queries.ts.
// Inlined to avoid circular dependency: program -> session -> program.
const SESSION_QUERY_KEY = ['session'] as const;

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
        queryKey: SESSION_QUERY_KEY,
      });
    },
  });

  return { updateDays, isPending };
}
