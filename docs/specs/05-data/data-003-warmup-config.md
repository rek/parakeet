# Spec: Warmup Config

**Status**: Implemented
**Domain**: Data / User Config

## What This Covers

CRUD operations for the user's warmup protocol preference per lift. Each lift (squat, bench, deadlift) can have a different protocol. Defaults to `standard` if no row is stored. Supabase SDK called directly from the app.

## Tasks

**Table: `warmup_configs`**
```sql
CREATE TABLE warmup_configs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  lift         TEXT NOT NULL,    -- 'squat' | 'bench' | 'deadlift'
  protocol     TEXT NOT NULL DEFAULT 'standard',
                                 -- 'standard' | 'minimal' | 'extended' | 'empty_bar' | 'custom'
  custom_steps JSONB,            -- only when protocol = 'custom'; [{ pct, reps }, ...]
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lift)
);

CREATE POLICY "users_own_warmup_config" ON warmup_configs
  FOR ALL USING (auth.uid() = user_id);
```

**`apps/mobile/lib/warmup-config.ts`:**

```typescript
// Get warmup protocol for a specific lift (falls back to 'standard' if no row)
async function getWarmupConfig(userId: string, lift: Lift): Promise<WarmupProtocol> {
  const { data } = await supabase
    .from('warmup_configs')
    .select('protocol, custom_steps')
    .eq('user_id', userId)
    .eq('lift', lift)
    .single()

  if (!data) return { type: 'preset', name: 'standard' }

  if (data.protocol === 'custom') {
    return { type: 'custom', steps: data.custom_steps }
  }
  return { type: 'preset', name: data.protocol as WarmupPresetName }
}

// Get warmup configs for all 3 lifts in one call
async function getAllWarmupConfigs(userId: string): Promise<Record<Lift, WarmupProtocol>> {
  const { data } = await supabase
    .from('warmup_configs')
    .select('lift, protocol, custom_steps')
    .eq('user_id', userId)

  const defaults: Record<Lift, WarmupProtocol> = {
    squat:    { type: 'preset', name: 'standard' },
    bench:    { type: 'preset', name: 'standard' },
    deadlift: { type: 'preset', name: 'standard' },
  }
  for (const row of data ?? []) {
    defaults[row.lift as Lift] = row.protocol === 'custom'
      ? { type: 'custom', steps: row.custom_steps }
      : { type: 'preset', name: row.protocol as WarmupPresetName }
  }
  return defaults
}

// Set protocol for a lift (upsert)
async function updateWarmupConfig(
  userId: string,
  lift: Lift,
  protocol: WarmupProtocol
): Promise<void> {
  await supabase.from('warmup_configs').upsert({
    user_id: userId,
    lift,
    protocol: protocol.type === 'custom' ? 'custom' : protocol.name,
    custom_steps: protocol.type === 'custom' ? protocol.steps : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,lift' })
}

// Reset to standard default (delete override row)
async function resetWarmupConfig(userId: string, lift: Lift): Promise<void> {
  await supabase
    .from('warmup_configs')
    .delete()
    .eq('user_id', userId)
    .eq('lift', lift)
}
```

**Settings screen — Warmup Protocols (`apps/mobile/app/(tabs)/settings.tsx`):**
- Three sections: Squat, Bench, Deadlift
- Each section has a protocol picker:
  - "Standard" — 40%×5, 60%×3, 75%×2, 90%×1 (default)
  - "Minimal" — 50%×5, 75%×2
  - "Extended" — 30%×10, 50%×5, 65%×3, 80%×2, 90%×1, 95%×1
  - "Empty Bar First" — bar×10, then 50%/70%/85%
  - "Custom" — reveals a step editor (see below)
- Below the picker: a preview of the warmup sets based on current 1RM for that lift
- Example for Squat 140kg 1RM, Block 1 Heavy (working weight ~112.5kg):
  `Standard → 45kg×5, 67.5kg×3, 85kg×2, 102.5kg×1`

**Custom step editor:**
- When "Custom" is selected, shows a list of steps: `[percentage] % × [reps] reps`
- Add/remove steps with +/− buttons
- Percentage input: 1–99 (integer, displayed as %)
- Reps input: 1–10
- Steps are kept in ascending percentage order
- Save button → calls `updateWarmupConfig()` with `type: 'custom'`

## Dependencies

- [../01-infra/infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
- [../04-engine/engine-010-warmup-calculator.md](../04-engine/engine-010-warmup-calculator.md)
