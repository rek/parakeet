import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { findTodaySession } from '../lib/sessions'

export function useTodaySession() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['session', 'today', user?.id],
    queryFn: () => findTodaySession(user!.id),
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  })
}
