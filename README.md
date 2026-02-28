# Parakeet

Progressive improvement.

Track, train, improve.

## What It Is

A Cube Method program generator and session tracker. The training engine runs locally in the app (no backend). Supabase handles auth, data storage, and cross-device sync. Post-v1, an LLM layer augments the rule-based engine for session adjustment and end-of-cycle coaching analysis — the system improves automatically as the models improve.

## Tech Stack

- **Expo SDK 54**, React Native, TypeScript
- **Nx monorepo** (`nx.json`) — `apps/parakeet`, `packages/training-engine`, `packages/shared-types`
- **Supabase** — Auth (Google OAuth) + Postgres + Realtime
- **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`) — post-v1, optional

## Key Architecture Decisions

| Decision        | Choice                                                     | Why                                                     |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| Backend         | None — Supabase SDK direct                                 | 2 users; zero operational overhead (ADR-006)            |
| Units           | KG only                                                    | DB stores integer grams (140 kg = 140,000 g)            |
| Training engine | On-device (`packages/training-engine`)                     | Instant JIT generation, fully offline                   |
| JIT sessions    | `planned_sets` null at creation; populated at workout time | Personalises every session with current state           |
| AI integration  | Vercel AI SDK, pluggable strategy                          | Models improve over time without code changes (ADR-007) |

## Monorepo Structure

```
apps/
  parakeet/                — Expo app (main entry point)
    app/                 — Expo Router screens
    lib/                 — Supabase SDK helpers (sessions, programs, etc.)
    hooks/               — React Query hooks
packages/
  training-engine/       — Cube Method formulas, JIT generator, AI strategies
  shared-types/          — Zod schemas shared between app and engine
supabase/
  migrations/            — SQL migration files (pushed via supabase db push)
docs/
  design/                — What and why (product-level)
  specs/                 — How (implementation tasks, numbered by dependency order)
  decisions/             — Architecture Decision Records (ADRs 001–007)
```

## Documentation

Start here:

1. `docs/design/training-engine-architecture.md` — full system overview and AI strategy
2. `docs/decisions/006-supabase-over-gcp.md` — why no backend
3. `docs/decisions/007-vercel-ai-sdk.md` — AI SDK choice and rationale
4. `docs/README.md` — complete docs index

## Production Deployment (Sideload)

We sideload directly to devices — no Play Store.

### 1. Create a release keystore (once)

```bash
keytool -genkey -v -keystore parakeet-release.keystore \
  -alias parakeet -keyalg RSA -keysize 2048 -validity 10000
```

Store this file securely (not in git). Add to `.gitignore`:
```
parakeet-release.keystore
```

### 2. Get release SHA-1

```bash
keytool -list -v -keystore parakeet-release.keystore -alias parakeet | grep SHA1
```

### 3. Register release SHA-1 in Google Cloud Console

Go to **APIs & Services → Credentials → Android OAuth client** and add the release SHA-1 alongside the debug one.

Also update `apps/parakeet/android/app/google-services.json` — add a second entry in `oauth_client` with `client_type: 1` and the release `certificate_hash`.

> **⚠️ Pre-production checklist:**
> - Debug SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
> - Release SHA-1: get from step 2 above
> - Both must be registered in GCP Console or Google Sign-In returns `DEVELOPER_ERROR`

### 4. Configure signing in Gradle

In `apps/parakeet/android/app/build.gradle`, add a `signingConfigs` block and wire it to the `release` build type. Use environment variables or a local `keystore.properties` file (not committed):

```properties
# keystore.properties (gitignored)
storeFile=../parakeet-release.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=parakeet
keyPassword=YOUR_KEY_PASSWORD
```

### 7. Point to hosted Supabase

Update `apps/parakeet/.env.local` (or a `.env.production` file) to use the hosted Supabase URL and anon key instead of `localhost`. Run `npm run db:push` first to ensure migrations are applied.

## Troubleshooting: `TypeError: Network request failed` on auth

If Google sign-in fails with `TypeError: Network request failed`, check local Supabase reachability first.

1. Confirm the app log prints the Supabase URL (`[supabase] URL: ...`).
2. For physical Android devices, set `EXPO_PUBLIC_SUPABASE_URL_ANDROID` to your dev machine LAN IP, e.g. `http://192.168.1.96:54321` (not `localhost`, not `10.0.2.2`).
3. Ensure phone and dev machine are on the same Wi-Fi network/subnet. This was the root cause in a real failure case.
4. Verify on phone browser: `http://<LAN_IP>:54321/auth/v1/health` should load.
5. If still failing, check firewall/VPN/guest-network isolation on the dev machine/router.

For building apk's we need to use prod supabase, since metro does not run we cannot point to local