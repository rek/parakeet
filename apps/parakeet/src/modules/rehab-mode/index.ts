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

export type {
  CreateRehabCapInput,
  RehabCap,
  RehabLift,
  UpdateRehabCapInput,
} from '@parakeet/shared-types';
