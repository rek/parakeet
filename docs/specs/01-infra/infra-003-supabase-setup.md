# Spec: Supabase Project Setup

**Status**: Implemented
**Domain**: Infrastructure

## What This Covers

Create and configure the Supabase project, set up local development environment, apply all RLS policies, and configure auth providers.

## Tasks

**Supabase project creation:**
- Create Supabase project at app.supabase.com: `parakeet-prod`
- Note the Project URL and anon key (stored in `.env.local` at workspace root, NOT committed)
- Install Supabase CLI: `npm install -g supabase`
- Run `supabase init` at workspace root (creates `supabase/` directory)
- Add `supabase/` to the monorepo; migrations live at `supabase/migrations/`

**Local development setup:**
- `supabase start` — spins up local Postgres + Studio (http://localhost:54323) + local auth
- Local `.env.local`:
  ```
  EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<local_anon_key>
  ```
- Production `.env.production` (not committed, set via EAS Secrets):
  ```
  EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<prod_anon_key>
  ```

**Auth providers (in Supabase dashboard):**
- Enable Email auth (for initial testing, no email confirmation required for personal use)
- Enable Google OAuth: configure Google Cloud OAuth credentials → paste client ID/secret into Supabase
- Enable Apple OAuth: configure Apple Developer Sign-in → paste client ID/secret into Supabase

**Row Level Security:**
Every user-data table must have RLS enabled and a policy that restricts access to the owning user:
```sql
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON <table_name>
  FOR ALL USING (auth.uid() = user_id);
```
Apply this to: `lifter_maxes`, `formula_configs`, `programs`, `sessions`, `session_logs`, `edge_cases`, `soreness_checkins`, `auxiliary_exercises`, `auxiliary_assignments`, `muscle_volume_config`, `performance_metrics`, `recovery_snapshots`.

**Keepalive (prevent free tier DB pause):**
In `apps/mobile/lib/supabase.ts`: on app foreground event, if last ping was > 5 days ago, run:
```typescript
await supabase.from('profiles').select('id').limit(1)
```
Store last ping time in AsyncStorage.

**Mobile SDK installation:**
```bash
npm install @supabase/supabase-js @react-native-async-storage/async-storage
```

## Dependencies

- [infra-001-nx-monorepo-setup.md](./infra-001-nx-monorepo-setup.md)
- [infra-005-database-migrations.md](./infra-005-database-migrations.md)

## References

- ADR: [006-supabase-over-gcp.md](../decisions/006-supabase-over-gcp.md)
