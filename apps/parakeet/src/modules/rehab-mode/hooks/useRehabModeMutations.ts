// @spec docs/features/rehab-mode/spec-app.md
import { useAuth } from '@modules/auth';
import { programQueries } from '@modules/program';
import { sessionQueries } from '@modules/session';
import type {
  CreateRehabCapInput,
  UpdateRehabCapInput,
} from '@parakeet/shared-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  enableRehabCap,
  endRehabCap,
  updateRehabCap,
} from '../application/rehab-mode.service';
import { rehabModeQueries } from '../data/rehab-mode.queries';

/**
 * Enable / update / end mutations for rehab caps. Each mutation invalidates
 * the active-caps query (chip row, per-lift caps) plus the active program +
 * session queries — future sessions' JIT prescriptions need to regenerate
 * with the cap state taken into account.
 */
export function useRehabModeMutations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  function invalidateAll() {
    void queryClient.invalidateQueries({
      queryKey: rehabModeQueries.all(),
    });
    void queryClient.invalidateQueries({
      queryKey: programQueries.active(userId).queryKey,
    });
    void queryClient.invalidateQueries({
      queryKey: sessionQueries.all(),
    });
  }

  const enable = useMutation({
    mutationFn: (input: CreateRehabCapInput) => {
      if (!userId) throw new Error('Not authenticated');
      return enableRehabCap(userId, input);
    },
    onSuccess: invalidateAll,
  });

  const update = useMutation({
    mutationFn: (args: { id: string; patch: UpdateRehabCapInput }) => {
      if (!userId) throw new Error('Not authenticated');
      return updateRehabCap(args.id, userId, args.patch);
    },
    onSuccess: invalidateAll,
  });

  const end = useMutation({
    mutationFn: (id: string) => {
      if (!userId) throw new Error('Not authenticated');
      return endRehabCap(id, userId);
    },
    onSuccess: invalidateAll,
  });

  return { enable, update, end };
}
