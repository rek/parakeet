# Spec: Supabase Client Setup (Mobile)

**Status**: Implemented
**Domain**: Mobile

## What This Covers

The Supabase client singleton for the mobile app, React Query integration, and the real-time sync subscription between devices.

## Tasks

**Packages:**
```bash
npm install @supabase/supabase-js @react-native-async-storage/async-storage
npm install @tanstack/react-query
```

**`apps/mobile/lib/supabase.ts`** — see [auth-001-supabase-auth-setup.md](../02-auth/auth-001-supabase-auth-setup.md) for the client singleton definition.

**`apps/mobile/lib/query-client.ts`:**
```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,    // 5 minutes
      gcTime: 1000 * 60 * 60,      // 1 hour
      retry: 2,
    },
  },
})
```

**`apps/mobile/app/_layout.tsx`:**
```typescript
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack />
      </AuthProvider>
    </QueryClientProvider>
  )
}
```

**React Query hooks pattern (example):**
```typescript
// apps/mobile/hooks/useActiveProgram.ts
export function useActiveProgram() {
  const userId = useUserId()
  return useQuery({
    queryKey: ['program', 'active', userId],
    queryFn: () => getActiveProgram(userId),
    enabled: !!userId,
  })
}

// apps/mobile/hooks/useTodaySession.ts
export function useTodaySession() {
  const userId = useUserId()
  return useQuery({
    queryKey: ['session', 'today', userId],
    queryFn: () => findTodaySession(userId),
    enabled: !!userId,
  })
}
```

**Real-time sync (Supabase Realtime):**
```typescript
// apps/mobile/hooks/useSessionSync.ts
// Subscribes to changes on the sessions table for the current user
// Useful for cross-device sync (e.g., wife's phone updates show on husband's)
export function useSessionSync(programId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('session-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `program_id=eq.${programId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['session'] })
        queryClient.invalidateQueries({ queryKey: ['program'] })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [programId, queryClient])
}
```

## Dependencies

- [auth-001-supabase-auth-setup.md](../02-auth/auth-001-supabase-auth-setup.md)
- [infra-001-nx-monorepo-setup.md](../01-infra/infra-001-nx-monorepo-setup.md)
