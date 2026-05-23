// @spec docs/features/rehab-mode/spec-app.md
export {
  enableRehabCap,
  endRehabCap,
  getActiveRehabCapForLift,
  getActiveRehabCaps,
  getRehabCap,
  getRehabCapHistory,
  updateRehabCap,
} from './application/rehab-mode.service';

export { rehabModeQueries } from './data/rehab-mode.queries';

export {
  ActiveRehabCapExistsError,
  type RehabCapRow,
} from './data/rehab-mode.repository';

export {
  useActiveRehabCaps,
  useRehabCapForLift,
} from './hooks/useActiveRehabCaps';
export { useRehabModeMutations } from './hooks/useRehabModeMutations';

export { RehabCapChipsRow } from './ui/RehabCapChipsRow';

export type {
  CreateRehabCapInput,
  Lift,
  RehabCap,
  UpdateRehabCapInput,
} from '@parakeet/shared-types';
