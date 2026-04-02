import { achievementQueries } from '@modules/achievements';
import { useAuth } from '@modules/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deleteBodyweightEntry } from '../application/bodyweight.service';
import { profileQueries } from '../data/profile.queries';

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
        queryKey: achievementQueries.wilksCurrent(user?.id).queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: achievementQueries.wilksHistory(user?.id).queryKey,
      });
    },
  });

  return { deleteEntry: mutation.mutate, isPending: mutation.isPending };
}
