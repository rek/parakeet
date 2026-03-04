# Commands for developers

### Supabase (local)

```bash
npm run db:start                 # Start local Postgres + Studio at localhost:54323
npm run db:reset                 # Apply migrations (drop + recreate)
npm run db:types                 # Generate TypeScript types → supabase/types.ts
npm run db:push                  # Push migrations to hosted Supabase
```

### Build production APK

Requires the native Android project to exist (`apps/parakeet/android/`). If it doesn't, run prebuild first:

```bash
# One-time: generate native Android project (re-run if you add/remove native packages)
cd apps/parakeet
npx expo prebuild --platform android --clean
```

Then build and copy to `dist/`:

```bash
# From workspace root — builds APK and copies to dist/apps/parakeet/parakeet-release.apk
nx buildApk parakeet
```

Env vars: the build picks up `.env.production` automatically via `app.config.ts`. Prod Supabase credentials are already set there.

### Sideload to device

```bash
adb install -r dist/apps/parakeet/parakeet-release.apk
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

- `supabase/types.ts` is generated DB contract only. Do not hand-edit.
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
