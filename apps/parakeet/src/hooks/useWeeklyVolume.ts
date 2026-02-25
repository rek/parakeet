import { useQuery } from '@tanstack/react-query'
import {
  computeWeeklyVolume,
  classifyVolumeStatus,
  computeRemainingCapacity,
  getMusclesForLift,
} from '@parakeet/training-engine'
import { useAuth } from './useAuth'
import { getMrvMevConfig } from '../lib/volume-config'
import { getProfile } from '../lib/profile'
import { getCurrentWeekLogs } from '../lib/sessions'

function currentWeekStart(): string {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - now.getDay())
  start.setHours(0, 0, 0, 0)
  return start.toISOString().split('T')[0]
}

export function useWeeklyVolume() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['volume', 'weekly', user?.id, currentWeekStart()],
    queryFn: async () => {
      const [logs, profile] = await Promise.all([
        getCurrentWeekLogs(user!.id),
        getProfile(),
      ])
      const config = await getMrvMevConfig(user!.id, profile?.biological_sex)
      const weekly = computeWeeklyVolume(logs, getMusclesForLift)
      const status = classifyVolumeStatus(weekly, config)
      const remaining = computeRemainingCapacity(weekly, config)
      return { weekly, status, remaining, config }
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  })
}
