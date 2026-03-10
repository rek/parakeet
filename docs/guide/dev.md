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

### Build production APK (local)

Requires the native Android project to exist (`apps/parakeet/android/`). If it doesn't, run prebuild first:

```bash
# One-time: generate native Android project (re-run if you add/remove native packages)
cd apps/parakeet
npx expo prebuild --platform android --clean
```

Then build:

```bash
# From workspace root — builds APK and copies to dist/apps/parakeet/parakeet-release.apk
nx build parakeet
```

Env vars: `nx build parakeet` sources workspace-root `.env.production`, disables Expo dotenv auto-loading (`EXPO_NO_DOTENV=1`), unsets `EXPO_PUBLIC_SUPABASE_URL_ANDROID`, and fails fast if `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` are missing.
Note: app runtime only honors `EXPO_PUBLIC_SUPABASE_URL_ANDROID` in `__DEV__`; production always uses `EXPO_PUBLIC_SUPABASE_URL`.

### Sideload to device

```bash
nx install parakeet
```

### Local development

```bash
# Start Expo dev server (Android/Web)
nx run parakeet:start
nx android parakeet

# Then in the Expo CLI menu:
#   Press a  → Android emulator
#   Press w  → Web browser (Metro web)

# Or start directly in web mode:
nx run parakeet:serve
```

If you want Wi-Fi IP mode instead of USB reverse, auto-update Android Supabase URL with:

```bash
npm run parakeet:android:ip
# optional explicit IP:
# npm run parakeet:android:ip -- --ip=192.168.1.42
```

For stable local auth/dev on a physical Android phone, prefer USB + `adb reverse` with `localhost` Supabase:

```bash
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

```bash
# Canonical: run all project tests
nx run-many -t test

# Run only tests affected by your branch changes
nx affected -t test

# Run app-only tests
nx run parakeet:test

# Run one package
nx run training-engine:test
nx run shared-types:test
nx run db:test

# Run a single test file directly
npx vitest run apps/parakeet/src/modules/session/data/session.repository.test.ts
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
