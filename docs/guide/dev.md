# Commands for developers

### Dashboard (AI telemetry web app)

```bash
npx nx serve dashboard              # Dev server at http://localhost:4200

# Validate
npx tsc --noEmit -p apps/dashboard/tsconfig.app.json
npx nx lint dashboard
```

Setup: copy local Supabase service_role key into `apps/dashboard/.env.local`.
See `apps/dashboard/README.md` for full setup and optional prod env vars.

---

### Supabase (local)

```bash
npm run db:start                 # Start local Postgres + Studio at localhost:54323
npm run db:reset                 # Apply migrations (drop + recreate)
npm run db:types                 # Generate TypeScript types → supabase/types.ts
npm run db:push                  # Push migrations to hosted Supabase
```

### Build production APK (EAS — preferred)

Builds are triggered manually via GitHub Actions:

1. Go to **Actions → EAS Build** in the GitHub repo
2. Click **Run workflow**
3. Select a profile: `preview` (internal APK) or `production`
4. Click **Run workflow**

EAS builds remotely and env vars are pulled from EAS secrets (managed on expo.dev → project → Secrets).

Profiles:
- `development` — dev client, internal distribution
- `preview` — APK, internal distribution (sideload-ready)
- `production` — APK, production

### Build APK locally (EAS Local — recommended)

Builds on your machine using EAS CLI. No native project checkout needed — EAS handles it.

```bash
# Preview APK (sideload-ready)
npm run build

# Production APK
npm run build:prod

# Development client
npm run build:dev
```

The `--local` flag runs the build on your machine instead of EAS servers.
The `--platform android` flag restricts to Android only (iOS is not used).
Output APK lands in the current directory.

Env vars are pulled from `eas.json` + EAS secrets (managed on expo.dev).

### Build APK locally (Nx — alternative)

Requires the native Android project to exist (`apps/parakeet/android/`). If it doesn't, run prebuild first:

```bash
# One-time: generate native Android project (re-run if you add/remove native packages)
npm run prebuild
```

**Adding native Expo packages:** Add to **both** the root `package.json` and `apps/parakeet/package.json`, then `npm install && npm run prebuild`. Autolinking only scans the app's `package.json` — a package in the root alone will pass TypeScript but crash at runtime.

Then build:

```bash
# From workspace root — builds APK and copies to dist/apps/parakeet/parakeet-release.apk
nx build parakeet
```

Env vars: `nx build parakeet` sources workspace-root `.env.production`, disables Expo dotenv auto-loading (`EXPO_NO_DOTENV=1`), unsets `EXPO_PUBLIC_SUPABASE_URL_ANDROID`, and fails fast if `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` are missing.
Note: app runtime only honors `EXPO_PUBLIC_SUPABASE_URL_ANDROID` in `__DEV__`; production always uses `EXPO_PUBLIC_SUPABASE_URL`.

### Sideload to device

```bash
npm run install:apk    # Installs the most recent APK from dist/ onto connected device
```

### Local development

```bash
# Start Expo dev server
npm start

# Build & run on Android (auto-detects LAN IP for Supabase)
npm run android

# Or start directly in web mode:
nx run parakeet:serve
```

`npm run android` sets `APP_ENV=development` (→ `.dev` package name) and auto-updates `EXPO_PUBLIC_SUPABASE_URL_ANDROID` with your LAN IP before launching.

For USB workflow, prefer `adb reverse` with `localhost` Supabase:

```bash
npm run bridge   # adb reverse for ports 54321 + 8081

# .env.local
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
# leave EXPO_PUBLIC_SUPABASE_URL_ANDROID unset for USB workflow
```

### Linting and type checking

```bash
nx run parakeet:lint
npx tsc -p apps/parakeet/tsconfig.app.json --noEmit
tsc --noEmit -p apps/parakeet/tsconfig.typecheck.json
```

### Testing

Always run tests via **nx** from the workspace root. Never call `npx vitest` directly — path aliases (`@modules`, `@platform`, `@shared`) only resolve through each project's vitest config.

```bash
# Canonical: run all project tests
npx nx run-many -t test

# Run only tests affected by your branch changes
npx nx affected -t test

# Single project
npx nx test parakeet
npx nx test training-engine
npx nx test shared-types
npx nx test db

# Filter to specific files (pass vitest args after --)
npx nx test parakeet -- src/modules/session/utils/
npx nx test parakeet -- src/modules/session/utils/computeDismissResult.test.ts

# Reporters
npx nx test parakeet -- --reporter=verbose   # see individual test names
npx nx test parakeet -- --reporter=json      # machine-readable output
```

Where test behavior is defined:

- Per-project test targets live in each `project.json` (for example `apps/parakeet/project.json`).
- Package-level test runner config lives beside the package (for example `packages/*/vitest.config.mts`).

Current projects with `test` targets:

- `parakeet` (`apps/parakeet`)
- `training-engine` (`packages/training-engine`)
- `shared-types` (`packages/shared-types`)
- `db` (`packages/db`)

If `nx run-many -t test` appears stuck:

```bash
NX_DAEMON=false nx run-many -t test
```

### Type ownership rules

- `supabase/types.ts` is generated DB contract only. Prefer `npm run db:types` after applying migrations. If the local Supabase instance is not running, hand-edit conservatively and re-generate at the next opportunity.
- Domain types shared across app + engine live in `packages/shared-types`.
- Engine-only algorithm/config types live in `packages/training-engine/src/types.ts`.
- App data layers should parse JSON columns at boundaries using `apps/parakeet/src/platform/network/json-codecs.ts` instead of ad-hoc `as` casts.
- Query Supabase from `apps/parakeet/src/modules/*/data/*` repositories using `typedSupabase`; avoid direct table access in hooks, screens, or UI components.
- Map DB row shapes to domain/engine input shapes in repositories. Do not pass raw DB rows downstream.
- Never assume timestamp or JSON column names from memory; use `supabase/types.ts` as the source of truth and fail fast on repository query errors.

### Android physical device setup

```bash
# Run once per USB connect (forwards phone's localhost:54321 → dev machine)
adb reverse tcp:54321 tcp:54321
adb reverse tcp:8081 tcp:8081   # Metro (usually auto-set by Expo)
```

This drops on every replug — re-run if you get network errors after reconnecting.
Only use `EXPO_PUBLIC_SUPABASE_URL_ANDROID=http://<LAN_IP>:54321` when debugging over Wi-Fi.
