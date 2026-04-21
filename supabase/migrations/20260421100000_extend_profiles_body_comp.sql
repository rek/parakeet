-- Extend profiles with body-composition + context fields needed for
-- macro-target calculation in the nutrition module.
--
-- All fields are nullable — the macro-targets fn in the app applies
-- documented defaults when values are missing (e.g. Mifflin-St Jeor
-- falls back to bodyweight-only protein target when height is null).
--
-- activity_level and goal are check-constrained so the UI picker and
-- the calc fn share a single vocabulary.

alter table public.profiles
  add column if not exists height_cm numeric(5, 1),
  add column if not exists lean_mass_kg numeric(5, 2),
  add column if not exists activity_level text,
  add column if not exists goal text;

alter table public.profiles
  drop constraint if exists profiles_activity_level_check;

alter table public.profiles
  add constraint profiles_activity_level_check
  check (
    activity_level is null
    or activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')
  );

alter table public.profiles
  drop constraint if exists profiles_goal_check;

alter table public.profiles
  add constraint profiles_goal_check
  check (
    goal is null
    or goal in ('cut', 'maintain', 'bulk')
  );

comment on column public.profiles.height_cm is
  'Height in cm. Required for Mifflin-St Jeor BMR. Null → bodyweight-only protein target in macro-targets fn.';
comment on column public.profiles.lean_mass_kg is
  'Lean body mass in kg. DEXA-preferred for lipedema-affected users (bioimpedance unreliable on affected limbs). If set, macro-targets uses Katch-McArdle BMR + lean-mass-based protein target.';
comment on column public.profiles.activity_level is
  'Self-reported weekly activity. Drives TDEE multiplier: sedentary 1.2, light 1.375, moderate 1.55, active 1.725, very_active 1.9.';
comment on column public.profiles.goal is
  'Calorie deficit/surplus: cut -15%, maintain 0%, bulk +10%.';
