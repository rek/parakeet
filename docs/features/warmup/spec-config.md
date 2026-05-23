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
                                 -- 'standard' | 'minimal' | 'extended' | 'empty_bar' | 'custom' | 'standard_female'
                                 -- 'standard_female' is the engine default for female users; stored if they save without changing
  custom_steps JSONB,            -- only when protocol = 'custom'; [{ pct, reps }, ...]
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lift)
);

CREATE POLICY "users_own_warmup_config" ON warmup_configs
  FOR ALL USING (auth.uid() = user_id);
```

**`apps/parakeet/lib/warmup-config.ts`:**
- [x] `getWarmupConfig(userId: string, lift: Lift, biologicalSex?): Promise<{ protocol: WarmupProtocol; explicit: boolean }>` — fetch protocol for a lift, falling back to `standard_female` (female) or `standard` (male/unset) if no row. `explicit` is `true` when a user-configured row exists.
- [x] `getAllWarmupConfigs(userId: string, biologicalSex?): Promise<Record<Lift, WarmupProtocol>>` — fetch all 3 lifts in one call, applying sex-appropriate defaults where rows are missing
- [x] `updateWarmupConfig(userId: string, lift: Lift, protocol: WarmupProtocol): Promise<void>` — upsert protocol for a lift
- [x] `resetWarmupConfig(userId: string, lift: Lift): Promise<void>` — delete override row, reverting to standard default

**Settings screen — Warmup Protocols (`apps/parakeet/app/(tabs)/settings.tsx`):**
- [x] Three sections: Squat, Bench, Deadlift
- [x] Each section has a protocol picker: Standard / Minimal / Extended / Empty Bar First / Custom
- [x] Below the picker: a preview of the warmup sets based on current 1RM for that lift
  - Example for Squat 140kg 1RM, Block 1 Heavy (working weight ~112.5kg): `Standard → 45kg×5, 67.5kg×3, 85kg×2, 102.5kg×1`
- [x] Custom step editor when "Custom" is selected: list of steps with +/− buttons, percentage (1–99) and reps (1–10) inputs, steps kept in ascending order, Save button calls `updateWarmupConfig()` with `type: 'custom'`
- [ ] All save paths (`handleSaveLift` per lift, custom step save) must wrap the `updateWarmupConfig()` call in `try/catch`; on error: `captureException(err)` + `Alert.alert('Save Failed', 'Could not save warmup config — please try again.')`
- [ ] **`apps/parakeet/src/modules/settings/lib/warmup-config.ts:1` has the wrong `@spec` tag.** It points at `docs/features/settings-and-tools/spec-bar-weight.md` (a different feature). Update the comment to `@spec docs/features/warmup/spec-config.md`.
- [x] (landed) **Defensive default inside the engine.** `resolveEffectiveWarmupProtocol` dereferences `opts.warmupConfig`. If any caller passes null, JIT crashes. Add a default — `{ type: 'preset', name: biologicalSex === 'female' ? 'standard_female' : 'standard' }` — at the start of the resolver to neutralise the case.

## Dependencies

- [infra-002-supabase-setup.md](../infra/spec-supabase.md)
- [engine-010-warmup-calculator.md](./spec-calculator.md)
