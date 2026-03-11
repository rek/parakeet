/**
 * React Query hook for feature flags.
 *
 * Returns all flags with defaults applied immediately (no loading state).
 * Individual flag reads use useFeatureEnabled(id).
 */

import { qk } from '@platform/query';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getFeatureFlags,
  setFeatureFlag,
  setFeatureFlags,
} from '../lib/feature-flags';
import { DEFAULT_FLAGS } from '../model/features';
import type { FeatureId } from '../model/features';

export function useFeatureFlags() {
  const queryClient = useQueryClient();

  const { data: flags = DEFAULT_FLAGS } = useQuery({
    queryKey: qk.featureFlags.all(),
    queryFn: getFeatureFlags,
    staleTime: Infinity,
    placeholderData: DEFAULT_FLAGS,
  });

  async function toggle({ id, enabled }: { id: FeatureId; enabled: boolean }) {
    const next = { ...flags, [id]: enabled };
    queryClient.setQueryData(qk.featureFlags.all(), next);
    await setFeatureFlag({ id, enabled });
  }

  async function applyPreset(preset: Record<FeatureId, boolean>) {
    queryClient.setQueryData(qk.featureFlags.all(), preset);
    await setFeatureFlags(preset);
  }

  return { flags, toggle, applyPreset };
}

export function useFeatureEnabled(id: FeatureId) {
  const { data: flags = DEFAULT_FLAGS } = useQuery({
    queryKey: qk.featureFlags.all(),
    queryFn: getFeatureFlags,
    staleTime: Infinity,
    placeholderData: DEFAULT_FLAGS,
  });

  return flags[id];
}
