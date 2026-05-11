import { useEffect, useState } from 'react';

import { useAuth } from '@modules/auth';
import { captureException } from '@platform/utils/captureException';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';

import { syncWearableData } from '../application/sync.service';
import { recoveryQueryKeys } from '../data/recovery.queries';

const LAST_SYNC_KEY = 'wearable_last_sync_ms';
const DEFAULT_TIMEOUT_MS = 8000;
const FRESH_THRESHOLD_MS = 60 * 1000; // skip sync if last run < 60s ago

/**
 * One-shot pre-checkin sync gate.
 *
 * Mount-side: actively trigger a Health Connect sync, await it (bounded by a
 * timeout so the user is never stuck behind a hanging native call), then
 * invalidate the today recovery snapshot query so the soreness pills prefill
 * from current data. Returns `true` once the sync settled (success, skip, or
 * timeout) so callers can gate downstream work (auto-generate) on a fresh
 * snapshot.
 *
 * Distinct from the AppState-driven background sync in `useWearableSync` —
 * that hook covers app foregrounding generically; this one ensures the soreness
 * screen always reads current data even when the user opens the app cold
 * straight onto the check-in flow.
 */
export function useEnsureFreshSnapshot(opts?: {
  timeoutMs?: number;
}): { resolved: boolean } {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [resolved, setResolved] = useState(false);
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const userId = user.id;

    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(LAST_SYNC_KEY);
        const lastSync = stored ? Number(stored) : 0;
        if (Date.now() - lastSync < FRESH_THRESHOLD_MS) {
          return;
        }

        await Promise.race([
          (async () => {
            await syncWearableData(userId);
            await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
          })(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('useEnsureFreshSnapshot: sync timeout')),
              timeoutMs
            )
          ),
        ]);

        if (cancelled) return;
        await queryClient.invalidateQueries({
          queryKey: recoveryQueryKeys.today(userId),
        });
      } catch (err) {
        // Timeout or sync failure is non-fatal — the existing snapshot (or its
        // absence) still drives prefill, and the user can override pills.
        captureException(err);
      } finally {
        if (!cancelled) setResolved(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, timeoutMs, queryClient]);

  return { resolved };
}
