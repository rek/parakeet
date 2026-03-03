import { QueryClient } from '@tanstack/react-query'
import { queryDefaultOptions } from '@platform/query/default-options'

export const queryClient = new QueryClient({
  defaultOptions: queryDefaultOptions,
})
