import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@modules/auth'
import { qk } from '@platform/query'
import { findTodaySession } from '../application/session.service'

export function useTodaySession() {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.session.today(user?.id),
    queryFn: () => findTodaySession(user!.id),
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  })
}
