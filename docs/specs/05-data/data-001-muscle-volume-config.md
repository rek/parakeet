# Spec: Muscle Volume Config

**Status**: Implemented
**Domain**: Data / User Config

## What This Covers

CRUD operations for the user's MEV/MRV configuration per muscle group. Supabase SDK calls directly from the parakeet app. Default values come from `DEFAULT_MRV_MEV_CONFIG_MALE` or `DEFAULT_MRV_MEV_CONFIG_FEMALE` in the training engine (selected based on the user's `biological_sex` profile field); the user can override any value in Settings → Volume Config. See [sex-based-adaptations.md](../design/../../design/sex-based-adaptations.md) for the full defaults table.

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
- [x] `getMrvMevConfig(userId: string): Promise<MrvMevConfig>` — fetch user's full config, merging DB rows over engine defaults for missing muscles
- [x] `updateMuscleConfig(userId: string, muscle: MuscleGroup, update: { mev?: number; mrv?: number }): Promise<void>` — upsert a single muscle's config
- [x] `resetMuscleToDefault(userId: string, muscle: MuscleGroup): Promise<void>` — delete the override row, reverting to research defaults

**Settings screen — Volume Config (`apps/parakeet/app/(tabs)/settings.tsx`):**
- [x] Display all 9 muscle groups with current MEV and MRV values
- [x] Each row: muscle name, MEV stepper input, MRV stepper input
- [x] Validation: `mev >= 0`, `mrv > mev`, `mrv <= 30` (hard cap)
- [x] Save button: calls `updateMuscleConfig()` for each changed row
- [x] "Reset to defaults" button: calls `resetMuscleToDefault()` for all muscles

## Dependencies

- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
- [engine-006-mrv-mev-calculator.md](../04-engine/engine-006-mrv-mev-calculator.md)
