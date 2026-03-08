import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@modules/auth/hooks/useAuth'
import { getInProgressSession } from '../application/session.service'

export function useInProgressSession() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['session', 'in-progress', user?.id],
    queryFn: () => getInProgressSession(user!.id),
    enabled: !!user?.id,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  })
}
