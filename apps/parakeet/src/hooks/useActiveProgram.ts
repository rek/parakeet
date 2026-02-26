import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { getActiveProgram } from '../lib/programs'
import { qk } from '../queries/keys'

export function useActiveProgram() {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.program.active(user?.id),
    queryFn: () => getActiveProgram(user!.id),
    enabled: !!user?.id,
  })
}
