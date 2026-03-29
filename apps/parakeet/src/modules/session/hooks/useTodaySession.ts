import { useAuth } from '@modules/auth';
import { qk } from '@platform/query';
import { useQuery } from '@tanstack/react-query';

import {
  findTodaySession,
  findTodaySessions,
} from '../application/session.service';

export function useTodaySession() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.session.today(user?.id),
    queryFn: () => findTodaySession(user!.id),
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useTodaySessions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...qk.session.today(user?.id), 'all'],
    queryFn: () => findTodaySessions(user!.id),
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}
