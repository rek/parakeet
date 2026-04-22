// @spec docs/features/settings-and-tools/spec-feature-flags.md
/**
 * AsyncStorage persistence for feature flags.
 *
 * Stores a single JSON object with all flag overrides.
 * Missing flags fall back to DEFAULT_FLAGS.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_FLAGS } from '../model/features';
import type { FeatureId } from '../model/features';

const STORAGE_KEY = 'feature_flags';

export async function getFeatureFlags() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FLAGS };
    const parsed = JSON.parse(raw) as Partial<Record<FeatureId, boolean>>;
    return { ...DEFAULT_FLAGS, ...parsed };
  } catch {
    return { ...DEFAULT_FLAGS };
  }
}

export async function setFeatureFlags(flags: Record<FeatureId, boolean>) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
}

export async function setFeatureFlag({
  id,
  enabled,
}: {
  id: FeatureId;
  enabled: boolean;
}) {
  const current = await getFeatureFlags();
  current[id] = enabled;
  await setFeatureFlags(current);
}
