# Scripts

Manual-use scripts. Build/CI scripts (`check-*`, `eas-build-*`) are omitted.

## Data Management

### `backup-prod.sh`

Dumps production Supabase data to a timestamped SQL file in `backups/`.

```sh
SUPABASE_DB_PASSWORD=<password> ./scripts/backup-prod.sh [--project-ref <ref>] [--output <path>]
```

### `import-csv.ts`

Imports historical workout data from Strong or NextSet CSV exports into Supabase as ad-hoc sessions. Auto-detects format and maps exercises via `PRESET_MAPPINGS` or interactive prompts.

```sh
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/import-csv.ts \
  --file <path> --user-id <uuid> [--unit kg|lbs] [--dry-run]
```

### `backfill-traces.ts`

Regenerates `jit_output_trace` for historical sessions that have `jit_input_snapshot` but no trace.

```sh
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/backfill-traces.ts [--dry-run]
```

### `user-snapshot.ts`

Prints a full diagnostic snapshot of a user's training state: profile, maxes, active program, formula config, schedule health, recent sessions, aux work, and aggregated warnings. Use this first when debugging prod data issues.

```sh
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/user-snapshot.ts [--user-id <uuid>]
```

### `review-session-data.ts`

Diagnostic tool that analyses JIT prescription accuracy across main lift calibration, aux exercise health, fatigue cascade, weight accuracy, and auto-recommendations.

```sh
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/review-session-data.ts
```

## Content Generation

### `generate-badge-images.ts`

Generates 192×192 circular PNG badge emblems using Google Imagen 3.

```sh
GOOGLE_AI_API_KEY=... npx tsx scripts/generate-badge-images.ts \
  [--dry-run] [--badge <id>] [--start-from <id>] [--force]
```

### `generate-exercise-videos.ts`

Generates 8-second looping MP4 exercise demo videos using Google Veo 3.

```sh
GOOGLE_AI_API_KEY=... npx tsx scripts/generate-exercise-videos.ts \
  [--dry-run] [--exercise <id>] [--start-from <id>] [--force]
```

## Development Helpers

### `install-latest-apk.sh`

Installs the most recent APK from `dist/` onto a connected Android device via `adb`.

```sh
./scripts/install-latest-apk.sh
```

### `set-android-supabase-ip.mjs`

Detects your local IP and writes `EXPO_PUBLIC_SUPABASE_URL_ANDROID` to `.env.local` for local Supabase dev on Android.

```sh
node scripts/set-android-supabase-ip.mjs [--ip=192.168.x.y]
```
