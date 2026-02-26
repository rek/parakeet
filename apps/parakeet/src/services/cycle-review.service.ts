import { subscribeToCycleReviewInserts } from '../data/cycle-review.repository';

export function onCycleReviewInserted(programId: string, onInsert: () => void): () => void {
  return subscribeToCycleReviewInserts(programId, onInsert);
}
