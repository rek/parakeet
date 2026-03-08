import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@modules/auth/hooks/useAuth'
import { getCurrentCycleContext } from '../lib/cycle-tracking'
import { qk } from '@platform/query'

export function useCyclePhase() {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.cycle.phase(user?.id),
    queryFn: () => getCurrentCycleContext(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  })
}
