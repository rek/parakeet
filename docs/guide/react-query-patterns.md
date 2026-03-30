# React Query Patterns

Reference for AI agents and developers working on the Parakeet data layer. Distilled from [TkDodo's Practical React Query](https://tkdodo.eu/blog/practical-react-query) (32-article series) and our current architecture.

---

## Mental Model

React Query is an **async state manager**, not a data fetching library. It manages Promises and keeps client-side snapshots of server state synchronized.

**Server state ≠ client state.** Server state is owned by the backend; the app borrows a snapshot. Never copy query data into `useState` — this breaks background updates.

**"Stale data is better than no data."** Show cached data immediately, refetch in the background. Check `data` before `error` in render logic.

---

## Query Keys

Keys are the identity of cached data. Treat them like `useEffect` dependency arrays.

### Rules

1. **Include all variables that affect the fetch** — if a param changes the response, it belongs in the key.
2. **Structure generic → specific**: `['todos', 'list', { filters }]`, `['todos', 'detail', id]`.
3. **Use key factories** — never write raw arrays. In Parakeet: `qk.session.today(userId)`.
4. **Co-locate keys with queryFn** via `queryOptions()` — separating them is a maintenance hazard.

### Invalidation Matching

Keys support fuzzy (prefix) matching. Invalidating `['todos']` hits `['todos', 'list']` and `['todos', 'detail', 1]`. Design hierarchies to exploit this.

---

## queryOptions (v5+)

The recommended abstraction for sharing query configuration.

```ts
const todoQueries = {
  all: () => ['todos'],
  lists: () => [...todoQueries.all(), 'list'],
  list: (filters: Filters) =>
    queryOptions({
      queryKey: [...todoQueries.lists(), filters],
      queryFn: () => fetchTodos(filters),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: [...todoQueries.all(), 'detail', id],
      queryFn: () => fetchTodo(id),
      staleTime: 5000,
    }),
}
```

**Why:**
- Zero runtime cost — just returns the object
- Type-tags queryKey so `getQueryData` infers the return type
- Works across `useQuery`, `useSuspenseQuery`, `prefetchQuery`, imperative calls
- Replaces thin wrapper hooks that add no logic beyond `useQuery({...})`
- Enables `select` overrides per call site: `useQuery({ ...todoQueries.detail(id), select: d => d.title })`

---

## Queries

### Configuration

| Setting | Default | Guidance |
|---------|---------|----------|
| `staleTime` | 0 | Increase per data volatility. 0 = always refetch on mount/focus. |
| `gcTime` | 5 min | Rarely needs changing. How long inactive cache entries survive. |
| `retry` | 3 | Set to `false` in tests. |

### Conditional Queries

Prefer `skipToken` over `enabled` + non-null assertions:

```ts
// Prefer
useQuery({
  queryKey: ['user', id],
  queryFn: id ? () => fetchUser(id) : skipToken,
})

// Avoid
useQuery({
  queryKey: ['user', id],
  queryFn: () => fetchUser(id!),  // unsafe assertion
  enabled: !!id,
})
```

### select for Partial Subscriptions

Components re-render only when their selected slice changes (via structural sharing):

```ts
// Component only re-renders when count changes, not when todo contents change
const { data: todoCount } = useQuery({
  ...todoQueries.list(filters),
  select: (data) => data.length,
})
```

Use for: derived values, single fields, computed aggregates. Don't over-optimize — only when profiling shows a problem.

---

## Mutations

Mutations are **imperative** — you call `mutate()` when you want. Queries are declarative — they run automatically.

### Invalidation vs Direct Update

- **Invalidation** (preferred default): marks cache stale, refetches when needed. Works with sorted lists, filters, computed views.
- **Direct update** (`setQueryData`): skip the refetch, update cache from mutation response. Best for simple toggles or when the mutation returns the complete updated object.
- **Optimistic updates**: show result before server confirms, rollback on failure. Use sparingly — only for high-confidence, instant-feedback scenarios.

### Callback Separation

```ts
// useMutation callbacks → data concerns (invalidation, cache updates)
const mutation = useMutation({
  mutationFn: updateTodo,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] })
  },
})

// mutate callbacks → UI concerns (toast, redirect, form reset)
mutation.mutate(values, {
  onSuccess: () => {
    toast.success('Saved')
    navigation.goBack()
  },
})
```

### Concurrent Mutations

When multiple mutations target the same data:
1. Cancel in-flight queries before optimistic updates
2. Only invalidate when no sibling mutations are pending: `isMutating({ mutationKey }) === 1`

---

## Error Handling (3 Layers)

| Layer | Scope | Use for |
|-------|-------|---------|
| **Global** `QueryCache.onError` | Once per failed request | Sentry, error toasts for background failures |
| **Error Boundary** `throwOnError` | Component subtree | 5xx crashes; use function form for granular control |
| **Local** per-hook | Single component | Specific UX (form validation errors, retry UI) |

Never use per-query `onError` for notifications — it fires once per observer (duplicates in multiple components).

Global callback pattern:

```ts
new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.state.data !== undefined) {
        // Background failure with existing data — toast, don't crash
        toast.error(`Update failed: ${error.message}`)
      }
      captureException(error)
    },
  }),
})
```

---

## Automatic Invalidation

Instead of manual `invalidateQueries` in every mutation, use a global strategy:

```ts
new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      // Targeted: use meta.invalidates if set
      const invalidates = mutation.meta?.invalidates as string[][] | undefined
      if (invalidates) {
        invalidates.forEach((key) =>
          queryClient.invalidateQueries({ queryKey: key })
        )
        return
      }
      // Fallback: invalidate everything (inactive queries just get marked stale)
      queryClient.invalidateQueries()
    },
  }),
})
```

Tag mutations with what they affect:

```ts
useMutation({
  mutationFn: updateTodo,
  meta: { invalidates: [['todos']] },
})
```

---

## TypeScript

1. **Type the queryFn return, not useQuery generics** — let inference flow.
2. **Use Zod at the network boundary** — runtime validation where external data enters.
3. **Don't destructure query results** if you need narrowing — `query.isSuccess` narrows `query.data`; destructured `data` stays `T | undefined`.
4. **Register global error types** via module augmentation if you want typed errors everywhere.

---

## Testing

1. **Fresh `QueryClient` per test** — prevents state leakage.
2. **Disable retries**: `retry: false` in test defaults.
3. **Mock at the network level** (MSW) — not at the hook level.
4. **Use `waitFor`** for async assertions: `await waitFor(() => expect(result.current.isSuccess).toBe(true))`.

---

## Forms

| Approach | When | Pattern |
|----------|------|---------|
| **Copy to form state** | Simple edit forms, single user | `defaultValues` from query data, `staleTime: Infinity` |
| **Keep server state live** | Collaborative editing | Only track dirty fields locally, merge with query data at render |

Always: disable submit with `isPending`, reset form in mutation `onSuccess`, invalidate query after mutation.

---

## Offline

| `networkMode` | Behavior | Use for |
|---------------|----------|---------|
| `online` (default) | Pauses when offline, `fetchStatus: 'paused'` | Standard apps |
| `offlineFirst` | First request always fires, retries pause | PWAs, service workers |
| `always` | Ignores connectivity entirely | Web workers, non-network async |

---

## Prefetching & Cache Seeding

- **Route loaders / prefetchQuery**: eliminate fetch waterfalls, especially with Suspense.
- **`initialData`**: cache-level, persisted, respects staleTime. Use `initialDataUpdatedAt` for staleness.
- **`placeholderData`**: observer-level, never cached, always triggers background refetch. Use for "fake it till you make it."

Rule of thumb: `initialData` for seeding from other queries, `placeholderData` for everything else.

---

## Anti-Patterns

| Don't | Do instead |
|-------|------------|
| Copy query data into `useState` | Use query data directly; derive with `select` |
| Pass params to `refetch()` | Change the query key (state drives fetch) |
| Write raw query key arrays | Use key factory (`qk.*` or `queryOptions`) |
| Use `onError` on individual queries for toasts | Use global `QueryCache.onError` |
| Disable `refetchOnWindowFocus` | Embrace it — it's the stale-while-revalidate UX |
| Optimize renders before profiling | Fix slow renders before reducing re-renders |
| Import `@tanstack/react-query` in screens | Always wrap in a module hook — screens are composition only |
