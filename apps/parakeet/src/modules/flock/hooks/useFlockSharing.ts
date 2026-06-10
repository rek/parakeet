// @spec docs/features/flock/spec-ui.md
import { useAuth } from '@modules/auth';
import { captureException } from '@platform/utils/captureException';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { publishCurrentFlockHighlight } from '../application/publish-highlight';
import { flockQueries } from '../data/flock.queries';
import {
  deleteFlockHighlight,
  setFlockSharing,
} from '../data/flock.repository';

/**
 * Read + toggle the current user's "share my highlights" opt-in. Enabling
 * publishes a card immediately from standing signals; disabling removes it.
 */
export function useFlockSharing() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const sharingQuery = useQuery(flockQueries.sharing(userId));

  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!userId) throw new Error('Not authenticated');
      await setFlockSharing(userId, enabled, new Date().toISOString());
      if (enabled) {
        await publishCurrentFlockHighlight(userId);
      } else {
        await deleteFlockHighlight(userId);
      }
    },
    onError: (err) => captureException(err),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: flockQueries.all() });
    },
  });

  return {
    sharingEnabled: sharingQuery.data ?? false,
    isLoading: sharingQuery.isLoading,
    setSharing: (enabled: boolean) => mutation.mutate(enabled),
    isUpdating: mutation.isPending,
  };
}
