# Spec: Supabase Project Setup

**Status**: Implemented
**Domain**: Infrastructure

## What This Covers

Create and configure the Supabase project, set up local development environment, apply all RLS policies, and configure auth providers.

## Tasks

**Supabase project creation:**
- [x] Create Supabase project at app.supabase.com: `parakeet-prod`
- [x] Note the Project URL and anon key (stored in `.env.local` at workspace root, NOT committed)
- [x] Install Supabase CLI: `npm install -g supabase`
- [x] Run `supabase init` at workspace root (creates `supabase/` directory)
- [x] Add `supabase/` to the monorepo; migrations live at `supabase/migrations/`

**Local development setup:**
- [x] `supabase start` — spins up local Postgres + Studio (http://localhost:54323) + local auth
- [x] Local `.env.local`:
  ```
  EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<local_anon_key>
  ```
- [x] Production `.env.production` (not committed, set via EAS Secrets):
  ```
  EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<prod_anon_key>
  ```

**Auth providers (in Supabase dashboard):**
- [x] Enable Email auth (for initial testing, no email confirmation required for personal use)
- [x] Enable Google OAuth: configure Google Cloud OAuth credentials → paste client ID/secret into Supabase
- [x] Enable Apple OAuth: configure Apple Developer Sign-in → paste client ID/secret into Supabase

**Row Level Security:**
Every user-data table must have RLS enabled and a policy that restricts access to the owning user:
```sql
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON <table_name>
  FOR ALL USING (auth.uid() = user_id);
```
- [x] Apply to: `lifter_maxes`, `formula_configs`, `programs`, `sessions`, `session_logs`, `edge_cases`, `soreness_checkins`, `auxiliary_exercises`, `auxiliary_assignments`, `muscle_volume_config`, `performance_metrics`, `recovery_snapshots`

**Keepalive (prevent free tier DB pause):**
- [x] In `apps/parakeet/lib/supabase.ts`: on app foreground event, if last ping was > 5 days ago, run:
  ```typescript
  await supabase.from('profiles').select('id').limit(1)
  ```
- [x] Store last ping time in AsyncStorage

**parakeet SDK installation:**
- [x] `npm install @supabase/supabase-js @react-native-async-storage/async-storage`

## Dependencies

- [infra-001-nx-monorepo-setup.md](./infra-001-nx-monorepo-setup.md)
- [infra-005-database-migrations.md](./infra-005-database-migrations.md)

## References

- ADR: [006-supabase-over-gcp.md](../decisions/006-supabase-over-gcp.md)
