// @spec docs/features/disruptions/spec-resolution.md
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { captureException } from '@platform/utils/captureException';
import { useFocusEffect } from 'expo-router';

import { DISRUPTION_SNOOZE_DAYS } from '../lib/disruption-shelf-life';

const KEY_PREFIX = 'disruption_snooze:';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Tracks which disruption IDs the user has snoozed via the "Remind me later"
 * action on the ongoing-disruption prompt. Snooze entries are stored per-id in
 * AsyncStorage as the unix-ms expiry timestamp. On focus we drop expired keys
 * and rebuild the in-memory set.
 *
 * Returns `snoozedIds` (Set) plus `snooze(id)` which writes the expiry and
 * updates state in one shot. Keys are namespaced with `disruption_snooze:` so
 * they never collide with the calibration prompt key.
 */
export function useDisruptionSnooze() {
  const [snoozedIds, setSnoozedIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const snoozed = new Set<string>();
      const allKeys = await AsyncStorage.getAllKeys();
      for (const key of allKeys) {
        if (!key.startsWith(KEY_PREFIX)) continue;
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        const expiresAt = Number(raw);
        if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
          snoozed.add(key.slice(KEY_PREFIX.length));
        } else {
          void AsyncStorage.removeItem(key);
        }
      }
      setSnoozedIds(snoozed);
    } catch (err) {
      captureException(err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  // Also refresh once on mount to cover the case where useFocusEffect
  // hasn't yet fired (initial render before the screen is focused).
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const snooze = useCallback(
    async (id: string) => {
      try {
        const expiresAt = Date.now() + DISRUPTION_SNOOZE_DAYS * MS_PER_DAY;
        await AsyncStorage.setItem(`${KEY_PREFIX}${id}`, String(expiresAt));
        setSnoozedIds((prev) => new Set([...prev, id]));
      } catch (err) {
        captureException(err);
      }
    },
    []
  );

  return { snoozedIds, snooze };
}
