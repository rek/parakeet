import { typedSupabase } from '../network/supabase-client';

export function subscribeToCycleReviewInserts(
  programId: string,
  onInsert: () => void,
): () => void {
  const channel = typedSupabase
    .channel(`cycle-review-${programId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'cycle_reviews',
        filter: `program_id=eq.${programId}`,
      },
      onInsert,
    )
    .subscribe();

  return () => {
    typedSupabase.removeChannel(channel);
  };
}
