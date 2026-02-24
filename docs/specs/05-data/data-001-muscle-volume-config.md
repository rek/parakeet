# Spec: Muscle Volume Config

**Status**: Implemented
**Domain**: Data / User Config

## What This Covers

CRUD operations for the user's MEV/MRV configuration per muscle group. Supabase SDK calls directly from the parakeet app. Default values come from `DEFAULT_MRV_MEV_CONFIG` in the training engine; the user can override any value in Settings → Volume Config.

## Tasks

**Table: `muscle_volume_config`**
```sql
CREATE TABLE muscle_volume_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  muscle      TEXT NOT NULL,   -- MuscleGroup enum value
  mev         INTEGER NOT NULL, -- sets/week
  mrv         INTEGER NOT NULL, -- sets/week
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, muscle)
);

CREATE POLICY "users_own_volume_config" ON muscle_volume_config
  FOR ALL USING (auth.uid() = user_id);
```

**`apps/parakeet/lib/volume-config.ts`:**

```typescript
// Fetch user's full MRV/MEV config, falling back to engine defaults for missing muscles
async function getMrvMevConfig(userId: string): Promise<MrvMevConfig> {
  const { data } = await supabase
    .from('muscle_volume_config')
    .select('muscle, mev, mrv')
    .eq('user_id', userId)

  // Merge DB rows over defaults; muscles with no row use DEFAULT_MRV_MEV_CONFIG
  const config = { ...DEFAULT_MRV_MEV_CONFIG }
  for (const row of data ?? []) {
    config[row.muscle as MuscleGroup] = { mev: row.mev, mrv: row.mrv }
  }
  return config
}

// Upsert a single muscle's config
async function updateMuscleConfig(
  userId: string,
  muscle: MuscleGroup,
  update: { mev?: number; mrv?: number }
): Promise<void> {
  const existing = await getMrvMevConfig(userId)
  const current = existing[muscle]
  await supabase.from('muscle_volume_config').upsert({
    user_id: userId,
    muscle,
    mev: update.mev ?? current.mev,
    mrv: update.mrv ?? current.mrv,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,muscle' })
}

// Reset a muscle back to research defaults (delete the override row)
async function resetMuscleToDefault(userId: string, muscle: MuscleGroup): Promise<void> {
  await supabase
    .from('muscle_volume_config')
    .delete()
    .eq('user_id', userId)
    .eq('muscle', muscle)
}
```

**Settings screen — Volume Config (`apps/parakeet/app/(tabs)/settings.tsx`):**
- Display all 9 muscle groups with current MEV and MRV values
- Each row: muscle name, MEV stepper input, MRV stepper input
- Validation: `mev >= 0`, `mrv > mev`, `mrv <= 30` (hard cap)
- Save button: calls `updateMuscleConfig()` for each changed row
- "Reset to defaults" button: calls `resetMuscleToDefault()` for all muscles

## Dependencies

- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
- [engine-006-mrv-mev-calculator.md](../04-engine/engine-006-mrv-mev-calculator.md)
