# Spec: Muscle Volume Config

**Status**: Implemented
**Domain**: Data / User Config

## What This Covers

CRUD operations for the user's MEV/MRV configuration per muscle group. Supabase SDK calls directly from the parakeet app. Default values come from `DEFAULT_MRV_MEV_CONFIG_MALE` or `DEFAULT_MRV_MEV_CONFIG_FEMALE` in the training engine (selected based on the user's `biological_sex` profile field); the user can override any value in Settings → Volume Config. See [sex-based-adaptations.md](../cycle-tracking/design.md) for the full defaults table.

## Tasks

**Table: `muscle_volume_config`**
```sql
CREATE TABLE muscle_volume_config (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id),
  muscle_group        TEXT NOT NULL,      -- MuscleGroup enum value
  mev_sets_per_week   SMALLINT NOT NULL,  -- sets/week
  mrv_sets_per_week   SMALLINT NOT NULL,  -- sets/week
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, muscle_group)
);

CREATE POLICY "users_own_volume_config" ON muscle_volume_config
  FOR ALL USING (auth.uid() = user_id);
```

**`apps/parakeet/lib/volume-config.ts`:**
- [x] `getMrvMevConfig(userId: string, biologicalSex?: BiologicalSex): Promise<MrvMevConfig>` — fetch user's full config, merging DB rows over engine defaults for missing muscles
- [x] `updateMuscleConfig(userId: string, muscle: MuscleGroup, update: { mev?: number; mrv?: number }): Promise<void>` — upsert a single muscle's config
- [x] `resetMuscleToDefault(userId: string, muscle: MuscleGroup): Promise<void>` — delete the override row, reverting to research defaults
- [ ] `updateMuscleConfig` must forward `biologicalSex` to its internal `getMrvMevConfig` call. Currently it does not (`const existing = await getMrvMevConfig(userId)`), so for female users the "current" fallback value used when `update.mev` or `update.mrv` is undefined resolves to the male default instead of the female default. Today's only caller (`saveMuscleConfigs`) always supplies both fields, masking the bug, but any future partial update (e.g. bump MRV only) on a female account will silently overwrite MEV with the male value. Fix: accept and pass through `biologicalSex` explicitly, or require the caller to pass both values.

**Settings screen — Volume Config (`apps/parakeet/app/(tabs)/settings.tsx`):**
- [x] Display all 9 muscle groups with current MEV and MRV values
- [x] Each row: muscle name, MEV stepper input, MRV stepper input
- [x] Validation: `mev >= 0`, `mrv > mev`, `mrv <= 30` (hard cap)
- [x] Save button: calls `updateMuscleConfig()` for each changed row
- [ ] Save button error handling: wrap in `try/catch`; on error: `captureException(err)` + `Alert.alert('Save Failed', 'Could not save volume config — please try again.')`; do not silently fail
- [x] "Reset to defaults" button: calls `resetMuscleToDefault()` for all muscles

## Dependencies

- [infra-002-supabase-setup.md](../infra/spec-supabase.md)
- [engine-006-mrv-mev-calculator.md](./spec-mrv-mev.md)
