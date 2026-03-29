import { useAuth } from '@modules/auth';
import { qk } from '@platform/query';
import { useQuery } from '@tanstack/react-query';

import { getActiveProgram } from '../application/program.service';

export function useActiveProgram() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.program.active(user?.id),
    queryFn: () => getActiveProgram(user!.id),
    enabled: !!user?.id,
  });
}
