// @spec docs/features/programs/spec-generation-api.md
import { useAuth } from '@modules/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createProgram } from '../application/program.service';
import type { CreateProgramInput } from '../application/program.service';
import { programQueries } from '../data/program.queries';

// SYNC: Mirrors sessionQueries.all() in @modules/session/data/session.queries.ts.
// Inlined to avoid circular dependency: program -> session -> program.
const SESSION_QUERY_KEY = ['session'] as const;

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
        queryKey: SESSION_QUERY_KEY,
      });
    },
  });

  return { startProgram, isPending };
}
