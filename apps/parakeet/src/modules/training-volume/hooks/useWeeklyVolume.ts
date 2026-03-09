import { useQuery } from '@tanstack/react-query'
import {
  computeWeeklyVolume,
  classifyVolumeStatus,
  computeRemainingCapacity,
  getMusclesForLift,
} from '@parakeet/training-engine'
import { useAuth } from '@modules/auth/hooks/useAuth'
import { getMrvMevConfig } from '../lib/volume-config'
import { getProfile } from '@modules/profile/application/profile.service'
import { getCurrentWeekLogs } from '@modules/session/application/session.service'

function rollingWindowStart(): string {
  const start = new Date()
  start.setDate(start.getDate() - 7)
  return start.toISOString().split('T')[0]
}

export function useWeeklyVolume() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['volume', 'weekly', user?.id, rollingWindowStart()],
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
