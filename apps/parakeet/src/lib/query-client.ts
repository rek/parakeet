import { QueryClient } from '@tanstack/react-query'
import { queryDefaultOptions } from '../queries/default-options'

export const queryClient = new QueryClient({
  defaultOptions: queryDefaultOptions,
})
