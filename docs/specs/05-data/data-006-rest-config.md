# Spec: Rest Config Data Access

**Status**: Implemented
**Domain**: Data Access

## What This Covers

Supabase table for user-stored rest time overrides, and the data-access wrapper in `apps/parakeet/src/lib/rest-config.ts`.

## Tasks

### Database Migration

Add to `supabase/migrations/` (new migration file):

```sql
CREATE TABLE rest_configs (
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lift           lift_type,                   -- NULL = applies to all lifts
  intensity_type intensity_type,              -- NULL = applies to all intensity types
  rest_seconds   integer NOT NULL CHECK (rest_seconds BETWEEN 30 AND 600),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, COALESCE(lift, 'all'), COALESCE(intensity_type, 'all'))
);

ALTER TABLE rest_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own rest configs"
  ON rest_configs FOR ALL USING (auth.uid() = user_id);
```

**Lookup precedence (most specific wins):**
1. `user_id + lift + intensity_type` (most specific)
2. `user_id + lift + NULL` (lift-specific, all intensities)
3. `user_id + NULL + intensity_type`
4. `user_id + NULL + NULL` (all lifts, all intensities)
5. Formula default (no row found)

---

### Data Access

**File: `apps/parakeet/src/lib/rest-config.ts`**

```typescript
import { supabase } from './supabase'
import type { Lift, IntensityType } from '@parakeet/shared-types'

// Fetch all user overrides — called once before JIT and passed in as JITInput.userRestOverrides
export async function getUserRestOverrides(userId: string) {
  const { data, error } = await supabase
    .from('rest_configs')
    .select('lift, intensity_type, rest_seconds')
    .eq('user_id', userId)
  if (error) throw error
  return data ?? []
}

// Upsert a single override
export async function setRestOverride(
  userId: string,
  restSeconds: number,
  lift?: Lift,
  intensityType?: IntensityType,
) {
  const { error } = await supabase.from('rest_configs').upsert({
    user_id: userId,
    lift: lift ?? null,
    intensity_type: intensityType ?? null,
    rest_seconds: restSeconds,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

// Reset all overrides for this user (Settings → Rest Timer → Reset to defaults)
export async function resetRestOverrides(userId: string) {
  const { error } = await supabase
    .from('rest_configs')
    .delete()
    .eq('user_id', userId)
  if (error) throw error
}
```

**Session prep integration** — in `apps/parakeet/src/lib/sessions.ts`, before calling the JIT generator, fetch overrides:
```typescript
const userRestOverrides = await getUserRestOverrides(userId)
// Pass as JITInput.userRestOverrides
```

## Dependencies

- [infra-005-database-migrations.md](../01-infra/infra-005-database-migrations.md)
- [engine-020-rest-config.md](../04-engine/engine-020-rest-config.md) — consumes overrides via JITInput
- [mobile-018-rest-timer-settings.md](../09-mobile/mobile-018-rest-timer-settings.md) — writes overrides via setRestOverride
