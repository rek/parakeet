// @spec docs/features/auth/spec-athlete-profile.md
import { useAuth } from '@modules/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deleteBodyweightEntry } from '../application/bodyweight.service';
import { profileQueries } from '../data/profile.queries';

// SYNC: These mirror achievementQueries.wilksCurrent/wilksHistory query keys.
// Inlined to avoid circular dependency: profile -> achievements -> wilks -> program.
// Keep in sync with achievementQueries in @modules/achievements/data/achievements.queries.ts.
function wilksCurrentKey(userId: string | undefined) {
  return ['achievements', 'wilks-current', userId] as const;
}
function wilksHistoryKey(userId: string | undefined) {
  return ['achievements', 'wilks-history', userId] as const;
}

/**
 * Mutation hook for deleting a bodyweight history entry.
 *
 * On success, invalidates bodyweight history, the current profile (which
 * caches the latest bodyweight), and both Wilks query keys.
 */
export function useDeleteBodyweight() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteBodyweightEntry(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: profileQueries.bodyweightHistory(user?.id).queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: profileQueries.current().queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: wilksCurrentKey(user?.id),
      });
      await queryClient.invalidateQueries({
        queryKey: wilksHistoryKey(user?.id),
      });
    },
  });

  return { deleteEntry: mutation.mutate, isPending: mutation.isPending };
}
