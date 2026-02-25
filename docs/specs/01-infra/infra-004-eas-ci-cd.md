# Spec: EAS Build and CI/CD

**Status**: Implemented
**Domain**: Infrastructure

## What This Covers

GitHub Actions CI (lint/test/typecheck) and EAS Build/Update for parakeet app deployment. No backend deployment pipeline needed (Supabase manages the DB; migrations are pushed via CLI).

## Tasks

**EAS Setup:**
- [x] Install and configure EAS CLI:
  ```bash
  npm install -g eas-cli
  eas login
  eas build:configure        # creates eas.json
  ```

**`apps/parakeet/eas.json`:**
- [x] Configure `eas.json` with development, preview, and production build profiles:
  ```json
  {
    "cli": { "version": ">= 13.0.0" },
    "build": {
      "development": {
        "developmentClient": true,
        "distribution": "internal",
        "env": { "EXPO_PUBLIC_SUPABASE_URL": "http://localhost:54321", "EXPO_PUBLIC_SUPABASE_ANON_KEY": "..." }
      },
      "preview": {
        "distribution": "internal",
        "env": { "EXPO_PUBLIC_SUPABASE_URL": "https://<ref>.supabase.co", "EXPO_PUBLIC_SUPABASE_ANON_KEY": "..." }
      },
      "production": {
        "autoIncrement": true,
        "env": { "EXPO_PUBLIC_SUPABASE_URL": "https://<ref>.supabase.co", "EXPO_PUBLIC_SUPABASE_ANON_KEY": "..." }
      }
    },
    "submit": {
      "production": {
        "ios": { "appleId": "...", "ascAppId": "..." },
        "android": { "serviceAccountKeyPath": "./google-service-account.json" }
      }
    }
  }
  ```

**EAS Secrets:**
- [x] Store production Supabase URL and anon key as EAS secrets:
  ```bash
  eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://..."
  eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..."
  ```

**`.github/workflows/ci.yml`:**
- [x] Trigger: pull_request to main
- [x] Steps: checkout → `npm ci` → `nx affected --target=typecheck` → `nx affected --target=lint` → `nx affected --target=test`
  - No build step in CI (EAS handles builds asynchronously)

**`.github/workflows/eas-build.yml`:**
- [x] Trigger: push to main (when `apps/parakeet/**` or `packages/**` changed)
- [x] Determine update type:
  - JS-only changes (no native module changes): `eas update --branch production --message "$COMMIT_MESSAGE"`
  - Native changes: `eas build --platform all --profile production --non-interactive`
- [x] Store `EXPO_TOKEN` as GitHub secret

**Database migration workflow:**
- [x] Local development: `supabase db reset` (wipes local, reapplies all migrations)
- [x] Production: `supabase db push` from developer machine (personal app, no automated migration pipeline needed)
- [x] Keep `supabase/migrations/` committed to git for reproducibility

**Rollback:**
- [x] EAS Update: `eas update --branch production --message "Rollback" --republish <update-id>`
- [x] DB migration: write a down migration SQL file manually, push via `supabase db push`

## Dependencies

- [infra-001-nx-monorepo-setup.md](./infra-001-nx-monorepo-setup.md)
- [infra-002-supabase-setup.md](./infra-002-supabase-setup.md)
