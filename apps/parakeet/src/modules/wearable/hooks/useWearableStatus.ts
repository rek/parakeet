import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { checkPermissions, isHealthConnectAvailable } from '../lib/health-connect';

export interface WearableStatus {
  isAvailable: boolean;
  isPermitted: boolean;
  lastSyncAt: number | null;
  isSyncing: boolean;
}

export function useWearableStatus(): WearableStatus {
  const [state, setState] = useState<WearableStatus>({
    isAvailable: false,
    isPermitted: false,
    lastSyncAt: null,
    isSyncing: false,
  });

  useEffect(() => {
    void (async () => {
      const isAvailable = await isHealthConnectAvailable();
      const perms = isAvailable
        ? await checkPermissions()
        : { granted: false, permissions: {} };
      const last = await AsyncStorage.getItem('wearable_last_sync_ms');
      setState({
        isAvailable,
        isPermitted: perms.granted,
        lastSyncAt: last ? Number(last) : null,
        isSyncing: false,
      });
    })();
  }, []);

  return state;
}
