# Spec: Disruption Resolution

**Status**: Implemented
**Domain**: Disruptions

## What This Covers

Resolving disruptions (marking them done), listing active/historical disruptions, and handling session revert when a past resolution date is specified.

## Tasks

**`apps/parakeet/lib/disruptions.ts` (additions):**

```typescript
// Resolve a disruption; optionally specify when recovery occurred
export async function resolveDisruption(
  disruptionId: string,
  userId: string,
  resolvedAt?: string  // ISO date; defaults to now
): Promise<void> {
  const resolvedDate = resolvedAt ?? new Date().toISOString()

  await supabase
    .from('disruptions')
    .update({ status: 'resolved', resolved_at: resolvedDate })
    .eq('id', disruptionId)
    .eq('user_id', userId)

  // If resolved_at is in the past, flag future sessions for JIT re-generation.
  // Sessions whose planned_sets were adjusted by this disruption should re-run JIT
  // so they return to normal loading. Clear planned_sets + jit_generated_at so the
  // JIT generator runs fresh when the user opens them.
  if (resolvedAt && new Date(resolvedAt) < new Date()) {
    const { data: disruption } = await supabase
      .from('disruptions')
      .select('session_ids_affected')
      .eq('id', disruptionId)
      .single()

    const sessionIds = disruption?.session_ids_affected ?? []
    if (sessionIds.length > 0) {
      await supabase
        .from('sessions')
        .update({ planned_sets: null, jit_generated_at: null })
        .in('id', sessionIds)
        .in('status', ['planned'])  // only unfilled future sessions
    }
  }
}

// Active disruptions for the Today screen banner
export async function getActiveDisruptions(userId: string) {
  const { data } = await supabase
    .from('disruptions')
    .select('id, disruption_type, severity, affected_lifts, description, affected_date_end')
    .eq('user_id', userId)
    .neq('status', 'resolved')
    .order('created_at', { ascending: false })
  return data ?? []
}

// Full history for the Settings / disruption history view
export async function getDisruptionHistory(
  userId: string,
  pagination: { page: number; pageSize: number }
) {
  const from = pagination.page * pagination.pageSize
  const to = from + pagination.pageSize - 1

  const { data, count } = await supabase
    .from('disruptions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to)

  return { items: data ?? [], total: count ?? 0 }
}

// Full detail of a single disruption
export async function getDisruption(disruptionId: string, userId: string) {
  const { data } = await supabase
    .from('disruptions')
    .select('*')
    .eq('id', disruptionId)
    .eq('user_id', userId)
    .single()
  return data
}
```

**Today screen active disruption banner:**

The `findTodaySession()` helper (defined in `sessions-001`) includes a joined query for active disruptions:

```typescript
// In sessions-001 findTodaySession — include active disruptions in the response
const { data } = await supabase
  .from('sessions')
  .select(`
    *,
    active_disruptions:disruptions!inner(
      id, disruption_type, severity, affected_lifts, description
    )
  `)
  .eq('user_id', userId)
  // ... rest of today query
```

If the join is complex, call `getActiveDisruptions(userId)` separately in the Today screen's React Query hook.

**Session revert logic:**

When `resolved_at` is in the past, sessions that had `planned_sets` modified by this disruption have `planned_sets` and `jit_generated_at` cleared. The next time the user opens those sessions, JIT runs from scratch using the full current state (no active disruption, normal loading). There is no `program_snapshot` field — JIT re-generation is the authoritative way to restore normal session weights.

## Dependencies

- [disruptions-002-apply-adjustment.md](./disruptions-002-apply-adjustment.md)
