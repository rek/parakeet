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

**`apps/parakeet/lib/warmup-config.ts`:**
- [x] `getWarmupConfig(userId: string, lift: Lift): Promise<WarmupProtocol>` — fetch protocol for a lift, falling back to `{ type: 'preset', name: 'standard' }` if no row
- [x] `getAllWarmupConfigs(userId: string): Promise<Record<Lift, WarmupProtocol>>` — fetch all 3 lifts in one call, applying defaults where rows are missing
- [x] `updateWarmupConfig(userId: string, lift: Lift, protocol: WarmupProtocol): Promise<void>` — upsert protocol for a lift
- [x] `resetWarmupConfig(userId: string, lift: Lift): Promise<void>` — delete override row, reverting to standard default

**Settings screen — Warmup Protocols (`apps/parakeet/app/(tabs)/settings.tsx`):**
- [x] Three sections: Squat, Bench, Deadlift
- [x] Each section has a protocol picker: Standard / Minimal / Extended / Empty Bar First / Custom
- [x] Below the picker: a preview of the warmup sets based on current 1RM for that lift
  - Example for Squat 140kg 1RM, Block 1 Heavy (working weight ~112.5kg): `Standard → 45kg×5, 67.5kg×3, 85kg×2, 102.5kg×1`
- [x] Custom step editor when "Custom" is selected: list of steps with +/− buttons, percentage (1–99) and reps (1–10) inputs, steps kept in ascending order, Save button calls `updateWarmupConfig()` with `type: 'custom'`

## Dependencies

- [../01-infra/infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
- [../04-engine/engine-010-warmup-calculator.md](../04-engine/engine-010-warmup-calculator.md)
