import { queryDefaultOptions } from '@platform/query/default-options';
import { captureException } from '@platform/utils/captureException';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: queryDefaultOptions,
  queryCache: new QueryCache({
    onError: (error) => {
      captureException(error);
    },
  }),
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      const invalidates = mutation.options.meta?.invalidates as
        | readonly unknown[][]
        | undefined;
      if (!invalidates) return;
      for (const queryKey of invalidates) {
        queryClient.invalidateQueries({ queryKey });
      }
    },
    onError: (error) => {
      captureException(error);
    },
  }),
});
