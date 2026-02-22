# Spec: EAS Build and CI/CD

**Status**: Planned
**Domain**: Infrastructure

## What This Covers

GitHub Actions CI (lint/test/typecheck) and EAS Build/Update for mobile app deployment. No backend deployment pipeline needed (Supabase manages the DB; migrations are pushed via CLI).

## Tasks

**EAS Setup:**
```bash
npm install -g eas-cli
eas login
eas build:configure        # creates eas.json
```

**`apps/mobile/eas.json`:**
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

**EAS Secrets:** Store production Supabase URL and anon key as EAS secrets (not in `eas.json`):
```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://..."
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..."
```

**`.github/workflows/ci.yml`:**
- Trigger: pull_request to main
- Steps: checkout → `npm ci` → `nx affected --target=typecheck` → `nx affected --target=lint` → `nx affected --target=test`
- No build step in CI (EAS handles builds asynchronously)

**`.github/workflows/eas-build.yml`:**
- Trigger: push to main (when `apps/mobile/**` or `packages/**` changed)
- Determine update type:
  - JS-only changes (no native module changes): `eas update --branch production --message "$COMMIT_MESSAGE"`
  - Native changes: `eas build --platform all --profile production --non-interactive`
- `EXPO_TOKEN` stored as GitHub secret

**Database migration workflow:**
- Local development: `supabase db reset` (wipes local, reapplies all migrations)
- Production: `supabase db push` from developer machine (personal app, no automated migration pipeline needed)
- Keep `supabase/migrations/` committed to git for reproducibility

**Rollback:**
- EAS Update: `eas update --branch production --message "Rollback" --republish <update-id>`
- DB migration: write a down migration SQL file manually, push via `supabase db push`

## Dependencies

- [infra-001-nx-monorepo-setup.md](./infra-001-nx-monorepo-setup.md)
- [infra-002-supabase-setup.md](./infra-002-supabase-setup.md)
