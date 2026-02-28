# Commands for developers

### Supabase (local)

```bash
npm run db:start                 # Start local Postgres + Studio at localhost:54323
npm run db:reset                 # Apply migrations (drop + recreate)
npm run db:types                 # Generate TypeScript types → supabase/types.ts
npm run db:push                  # Push migrations to hosted Supabase
```

### Build APK

new: `nx buildApk parakeet`

old:

# this makes an aab, only good for confirming build is good or giving to play store
```sh
nx build parakeet --local --platform android
```

```bash
cd apps/parakeet/android && ./gradlew build --warning-mode=all
# or
cd apps/parakeet && expo run:android --variant release
# or
cd android && ./gradlew assembleRelease
```

APK output: `apps/parakeet/android/app/build/outputs/apk/release/app-release.apk`

### Sideload to device

```bash
adb install -r apps/parakeet/android/app/build/outputs/apk/release/app-release.apk
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
```


### Android physical device setup

```bash
# Run once per USB connect (forwards phone's localhost:54321 → dev machine)
adb reverse tcp:54321 tcp:54321
adb reverse tcp:8081 tcp:8081   # Metro (usually auto-set by Expo)
```

This drops on every replug — re-run if you get network errors after reconnecting.