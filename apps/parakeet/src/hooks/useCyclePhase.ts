import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { getCurrentCycleContext } from '../lib/cycle-tracking'
import { qk } from '../queries/keys'

export function useCyclePhase() {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.cycle.phase(user?.id),
    queryFn: () => getCurrentCycleContext(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  })
}
