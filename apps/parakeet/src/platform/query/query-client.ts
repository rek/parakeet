import { queryDefaultOptions } from '@platform/query/default-options';
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: queryDefaultOptions,
});
