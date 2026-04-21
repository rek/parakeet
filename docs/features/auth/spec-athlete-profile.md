# Spec: Athlete Profile

**Status**: Implemented
**Domain**: Data / User Config

## What This Covers

Storage and collection of athlete demographic data: gender, date of birth, and bodyweight. These are used to:
- Select sex-appropriate MEV/MRV defaults (see data-001)
- Provide age context to LLM coaching systems (engine-011, engine-012)
- Compute Wilks score and estimate 1RM when no lifter max is recorded

## Tasks

**DB migration — `supabase/migrations/20260226000000_add_athlete_demographics.sql`:**
- [x] `ALTER TABLE profiles ADD COLUMN date_of_birth DATE;`
  - `biological_sex` was already present from the initial schema; `date_of_birth` is nullable

**`packages/shared-types/src/user.schema.ts`:**
- [x] `UserSchema`: add `date_of_birth: z.string().nullable().optional()`
- [x] `UpdateUserSchema`: same addition

**`apps/parakeet/src/modules/profile/application/profile.service.ts`:**
- [x] `Profile` interface: includes `biological_sex: BiologicalSex | null` and `date_of_birth: string | null`
- [x] `getProfile()`: SELECT includes `biological_sex, date_of_birth`
- [x] `updateProfile(update)`: accepts `biological_sex` and `date_of_birth`

**`apps/parakeet/src/app/(auth)/onboarding/program-settings.tsx`:**
- [x] Gender: segmented control (Female / Male)
- [x] Birth year: required numeric input (4 digits); stored as `YYYY-01-01` ISO date
- [x] On submit: calls `updateProfile({ biological_sex, date_of_birth })` alongside `createProgram()`

**DB migration — `supabase/migrations/20260303000000_add_bodyweight_to_profiles.sql`:**
- [x] `ALTER TABLE profiles ADD COLUMN bodyweight_kg NUMERIC(5,2);`

**`apps/parakeet/src/modules/profile/data/profile.repository.ts`:**
- [x] Add `bodyweight_kg` to `ProfileRecord`, `ProfileUpdateRecord`, and SELECT

**`apps/parakeet/src/modules/profile/application/profile.service.ts`:**
- [x] `Profile.bodyweight_kg: number | null`
- [x] `UpdateProfileInput` includes `bodyweight_kg`

**`apps/parakeet/src/app/profile/index.tsx`:**
- [x] Optional "Bodyweight (kg)" decimal input field; saved via `updateProfile()`

**DB migration — `supabase/migrations/20260421100000_extend_profiles_body_comp.sql`:** (body-comp extension for nutrition macro targets)
- [x] `ALTER TABLE profiles ADD height_cm, lean_mass_kg, activity_level, goal` (all nullable). Enum check constraints on the latter two.
  → `supabase/migrations/20260421100000_extend_profiles_body_comp.sql`

**`apps/parakeet/src/modules/profile/`** (body-comp extension):
- [x] `Profile` + `UpdateProfileInput` extended with `height_cm`, `lean_mass_kg`, `activity_level`, `goal`
- [x] `getProfileById` SELECT extended; service normalises `activity_level` / `goal` via type predicates (no `as` casts)
- [x] `useSaveProfile` persists the new fields through `SaveProfileArgs`

**`apps/parakeet/src/app/profile/index.tsx`** (body-comp extension):
- [x] "Body composition & activity" card added below the primary profile card. Height (cm), lean mass (kg, with DEXA-preferred helper), activity-level picker (5 options), goal picker (3 options). All optional; drive macro-target accuracy.

See [../nutrition/spec-macro-targets.md](../nutrition/spec-macro-targets.md) for the calculator that consumes these fields.

## Design Notes

- Gender drives MEV/MRV defaults — female defaults are ~20–30% higher per RP Strength research
- Birth year only — not full date of birth — for privacy and simplicity
- Age is passed as context to AI systems; no hard-coded age-based volume adjustments
- See `../cycle-tracking/design.md` for the full research rationale

## Dependencies

- [infra-002-supabase-setup.md](../infra/spec-supabase.md)
- [data-001-muscle-volume-config.md](../volume/spec-volume-config.md)
- [engine-007-jit-session-generator.md](../jit-pipeline/spec-generator.md)
