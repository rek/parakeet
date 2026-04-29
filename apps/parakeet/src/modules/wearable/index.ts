// Application
export {
  syncWearableData,
  type SyncResult,
} from './application/sync.service';
export {
  computeAndStoreRecoverySnapshot,
  deriveNonTrainingLoad,
} from './application/recovery.service';

// Data — exposed for JIT wiring + cycle review
export {
  fetchTodaySnapshot,
  fetchSnapshotsForRange,
} from './data/recovery.repository';

// Hooks
export { useRecoverySnapshot } from './hooks/useRecoverySnapshot';
export { useWearableStatus } from './hooks/useWearableStatus';
export { useWearableSync } from './hooks/useWearableSync';

// UI — Phase 1 settings
export { WearableSettings } from './ui/WearableSettings';
