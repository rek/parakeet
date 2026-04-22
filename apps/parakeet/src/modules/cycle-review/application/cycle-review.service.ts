// @spec docs/features/cycle-review/spec-generator.md
import { subscribeToCycleReviewInserts } from '../data/cycle-review.repository';
import { getCycleReview, triggerCycleReview } from '../lib/cycle-review';

export { getCycleReview, triggerCycleReview };

export function onCycleReviewInserted(
  programId: string,
  onInsert: () => void
): () => void {
  return subscribeToCycleReviewInserts(programId, onInsert);
}
