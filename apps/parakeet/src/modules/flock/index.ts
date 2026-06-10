// @spec docs/features/flock/spec-data-foundation.md
// Public API for the Flock feature (closed, opt-in motivational feed).
export type { FlockHighlightInput, HeadlineKind } from './model/flock.types';
export { flockQueries } from './data/flock.queries';
export {
  publishFlockHighlight,
  publishCurrentFlockHighlight,
} from './application/publish-highlight';
export { useFlock } from './hooks/useFlock';
export { useFlockSharing } from './hooks/useFlockSharing';
export { FlockScreen } from './ui/FlockScreen';
export { FlockCard } from './ui/FlockCard';
