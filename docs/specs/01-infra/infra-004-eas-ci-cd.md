# Spec: CI and Android Build / Deployment

**Status**: Implemented
**Domain**: Infrastructure

## What This Covers

GitHub Actions CI (lint/test/typecheck) and local Android APK builds for distribution. No iOS support — Android only. No Play Store — APK is sideloaded directly onto devices. No automated build CI (builds are run locally by the developer).

## Platform

**Android only.** iOS is not supported. Do not add iOS-specific configuration.

## CI (GitHub Actions)

**`.github/workflows/ci.yml`:**
- Trigger: push or pull_request to main
- Steps: checkout → `npm ci` → `nx affected --target=typecheck` → `nx affected --target=lint` → `nx affected --target=test`
- No build step in CI — builds are done locally

## Local Android Build

Production APK is built locally and sideloaded onto devices.

**One-time setup:**
```bash
# Generate native Android project (only needed when native deps change)
cd apps/parakeet
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
EXPO_PUBLIC_SUPABASE_ANON_KEY=<prod_anon_key> \
npx expo prebuild --platform android --clean
```

**Build release APK:**
```bash
cd apps/parakeet/android
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

**Distribute:**
- Share `app-release.apk` directly (AirDrop, file share, etc.)
- Enable "Install unknown apps" on device settings
- No signing config needed for sideloading to personal devices (debug signing is fine)

**Env vars for prod build:**
- Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as shell env vars before `expo prebuild`, or put them in `.env.production` (gitignored)

## `apps/parakeet/eas.json`

Kept for local development profiles only (not used in CI):
```json
{
  "cli": { "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "apk" }
    }
  }
}
```

## Database Migration Workflow

- Local development: `npx supabase db reset` (wipes local, reapplies all migrations)
- Production: `npx supabase db push` from developer machine
- Keep `supabase/migrations/` committed to git for reproducibility

**Check migration status:**
```bash
npx supabase migration list   # shows local vs remote
npx supabase db push --dry-run  # preview what would be pushed
npx supabase db push            # apply to prod
```

## Rollback

- APK: reinstall the previous APK file
- DB migration: write a down migration SQL file manually, push via `npx supabase db push`

## Dependencies

- [infra-001-nx-monorepo-setup.md](./infra-001-nx-monorepo-setup.md)
- [infra-003-supabase-setup.md](./infra-003-supabase-setup.md)
