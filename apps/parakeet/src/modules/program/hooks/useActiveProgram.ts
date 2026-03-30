import { useAuth } from '@modules/auth';
import { useQuery } from '@tanstack/react-query';

import { programQueries } from '../data/program.queries';

export function useActiveProgram() {
  const { user } = useAuth();
  return useQuery(programQueries.active(user?.id));
}
