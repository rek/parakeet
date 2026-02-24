import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { getCycleReview } from '../lib/cycle-review'
import { supabase } from '../lib/supabase'

export function useCycleReview(programId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['cycle-review', programId, user?.id],
    queryFn: () => getCycleReview(programId, user!.id),
    enabled: !!user?.id && !!programId,
    // Poll every 10s until data arrives, then stop
    refetchInterval: (query) => (query.state.data ? false : 10_000),
  })

  // Realtime subscription for instant update when row is inserted
  useEffect(() => {
    if (!programId || !user?.id) return

    const channel = supabase
      .channel(`cycle-review-${programId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cycle_reviews',
          filter: `program_id=eq.${programId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['cycle-review', programId] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [programId, user?.id, queryClient])

  return query
}
