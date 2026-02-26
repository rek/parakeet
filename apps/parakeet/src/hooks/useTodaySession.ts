import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { findTodaySession } from '../lib/sessions'
import { qk } from '../queries/keys'

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
