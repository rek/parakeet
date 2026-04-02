import { useAuth } from '@modules/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { addBodyweightEntry } from '../application/bodyweight.service';
import { updateProfile } from '../application/profile.service';
import type { BiologicalSex } from '../application/profile.service';
import { profileQueries } from '../data/profile.queries';
import { birthYearToDobIso } from '../utils/profile-transforms';

// SYNC: These mirror achievementQueries.wilksCurrent/wilksHistory query keys.
// Inlined to avoid circular dependency: profile -> achievements -> wilks -> program.
// Keep in sync with achievementQueries in @modules/achievements/data/achievements.queries.ts.
function wilksCurrentKey(userId: string | undefined) {
  return ['achievements', 'wilks-current', userId] as const;
}
function wilksHistoryKey(userId: string | undefined) {
  return ['achievements', 'wilks-history', userId] as const;
}

interface SaveProfileArgs {
  displayName: string;
  gender: BiologicalSex | null;
  birthYear: string;
  bodyweightKg: string;
}

/**
 * Mutation hook for saving profile edits.
 *
 * On success, invalidates profile, bodyweight history, and both Wilks
 * query keys so the achievements screen reflects the updated data.
 */
export function useSaveProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      displayName,
      gender,
      birthYear,
      bodyweightKg,
    }: SaveProfileArgs) => {
      const dobIso = birthYearToDobIso(birthYear);

      const parsedBodyweight = bodyweightKg.trim()
        ? parseFloat(bodyweightKg)
        : null;
      const validBodyweight =
        parsedBodyweight != null && !isNaN(parsedBodyweight)
          ? parsedBodyweight
          : null;

      await updateProfile({
        display_name: displayName.trim() ? displayName.trim() : null,
        biological_sex: gender,
        date_of_birth: dobIso,
        bodyweight_kg: validBodyweight,
      });

      if (validBodyweight != null) {
        const d = new Date();
        const recordedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        await addBodyweightEntry({ recordedDate, weightKg: validBodyweight });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: profileQueries.current().queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: profileQueries.bodyweightHistory(user?.id).queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: wilksCurrentKey(user?.id),
      });
      await queryClient.invalidateQueries({
        queryKey: wilksHistoryKey(user?.id),
      });
    },
  });

  return {
    saveProfile: mutation.mutate,
    isPending: mutation.isPending,
    isError: mutation.isError,
  };
}
