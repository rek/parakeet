# Spec: Athlete Profile

**Status**: Implemented
**Domain**: Data / User Config

## What This Covers

Storage and collection of athlete demographic data: biological sex and date of birth. These are used to:
- Select sex-appropriate MEV/MRV defaults (see data-001)
- Provide age context to LLM coaching systems (engine-011, engine-012)

## Tasks

**DB migration — `supabase/migrations/20260226000000_add_athlete_demographics.sql`:**
- [x] `ALTER TABLE profiles ADD COLUMN date_of_birth DATE;`
  - `biological_sex` was already present from the initial schema; `date_of_birth` is nullable

**`packages/shared-types/src/user.schema.ts`:**
- [x] `UserSchema`: add `date_of_birth: z.string().nullable().optional()`
- [x] `UpdateUserSchema`: same addition

**`apps/parakeet/src/lib/profile.ts`:**
- [x] `Profile` interface: includes `biological_sex: BiologicalSex | null` and `date_of_birth: string | null`
- [x] `getProfile()`: SELECT includes `biological_sex, date_of_birth`
- [x] `updateProfile(update)`: accepts `biological_sex` and `date_of_birth`

**`apps/parakeet/src/app/(auth)/onboarding/program-settings.tsx`:**
- [x] Biological sex: segmented control (Female / Male / Prefer not to say), defaults to "Prefer not to say"
- [x] Birth year: optional numeric input (4 digits); stored as `YYYY-01-01` ISO date
- [x] On submit: calls `updateProfile({ biological_sex, date_of_birth })` alongside `createProgram()`

## Design Notes

- Biological sex (not gender identity) drives MEV/MRV defaults — female defaults are ~20–30% higher per RP Strength research
- `prefer_not_to_say` → male (conservative) defaults
- Birth year only — not full date of birth — for privacy and simplicity
- Age is passed as context to AI systems; no hard-coded age-based volume adjustments
- See `docs/design/sex-based-adaptations.md` for the full research rationale

## Dependencies

- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
- [data-001-muscle-volume-config.md](./data-001-muscle-volume-config.md)
- [engine-007-jit-session-generator.md](../04-engine/engine-007-jit-session-generator.md)
