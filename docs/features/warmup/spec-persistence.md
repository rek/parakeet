# mobile-027: Warmup Set Persistence

## Status: Planned

## Context

Warm-up sets are currently UI-only — shown during a session from the JIT output, tracked locally via `sessionStore.warmupCompleted` (a set of completed indices), but never written to the database.

**Important:** Per `../volume/design-methodology.md`, warm-up sets do NOT count toward MRV (they are not hard sets). This spec is NOT about MRV — it's about capturing warm-up history for analytical purposes.

## Why Persist Warmups

- Session review: see what warm-up was performed before a heavy set
- Coach/athlete review: verify warm-up compliance
- Future readiness analysis: correlate warm-up structure with session performance

## What to Persist

Add `warmup_sets` JSONB column to `session_logs` table.

Each entry:
```json
{
  "set_number": 1,
  "weight_grams": 60000,
  "reps": 5
}
```

Source data: JIT output `warmup.steps[]` filtered to only completed steps (via `sessionStore.warmupCompleted`).

## Schema Change

```sql
ALTER TABLE session_logs ADD COLUMN warmup_sets JSONB;
```

## App Changes

1. `sessionStore`: Already tracks `warmupCompleted: Set<number>` — need to also store the warmup steps themselves (from JIT output / `cachedJitData`)
2. `complete.tsx`: Include completed warmup steps in `completeSession` call
3. `session.service.ts` / `CompleteSessionInput`: Add `warmupSets?: WarmupSet[]`
4. `session.repository.ts` / `insertSessionLog`: Write `warmup_sets` to DB
5. DO NOT include warmup sets in `getCurrentWeekLogs` or `computeWeeklyVolume`

## Type

```typescript
interface WarmupSet {
  set_number: number
  weight_grams: number
  reps: number
}
```
