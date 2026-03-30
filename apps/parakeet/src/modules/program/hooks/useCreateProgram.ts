import { useAuth } from '@modules/auth';
import { sessionQueries } from '@modules/session';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createProgram } from '../application/program.service';
import type { CreateProgramInput } from '../application/program.service';
import { programQueries } from '../data/program.queries';

export function useCreateProgram() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { mutateAsync: startProgram, isPending } = useMutation({
    mutationFn: (input: CreateProgramInput) => createProgram(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: programQueries.active(user?.id).queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: sessionQueries.all(),
      });
    },
  });

  return { startProgram, isPending };
}
