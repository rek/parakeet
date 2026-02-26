import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { getCycleReview } from '../lib/cycle-review'
import { qk } from '../queries/keys'
import { onCycleReviewInserted } from '../services/cycle-review.service'

export function useCycleReview(programId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: qk.cycleReview.byProgram(programId, user?.id),
    queryFn: () => getCycleReview(programId, user!.id),
    enabled: !!user?.id && !!programId,
    // Poll every 10s until data arrives, then stop
    refetchInterval: (query) => (query.state.data ? false : 10_000),
  })

  // Realtime subscription for instant update when row is inserted
  useEffect(() => {
    if (!programId || !user?.id) return

    return onCycleReviewInserted(programId, () => {
      queryClient.invalidateQueries({
        queryKey: qk.cycleReview.byProgramPrefix(programId),
      })
    })
  }, [programId, user?.id, queryClient])

  return query
}
