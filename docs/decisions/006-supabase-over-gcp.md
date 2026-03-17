# ADR-006: Supabase

**Date**: 2026-02-22
**Status**: Accepted

## Context

Cloud-scale infrastructure like GCP is not required. The app needs auth, a database, and cross-device sync — not container orchestration.

## Decision

Replace the entire GCP backend stack with **Supabase** (free tier). Move the training engine into the parakeet app package (runs locally on-device). Eliminate the custom REST API entirely.

Stack:

- **Supabase Auth** — user sign-in (replaces Firebase Auth)
- **Supabase Postgres** — primary data store (replaces Cloud SQL + REST API)
- **Supabase Realtime** — cross-device sync for each user's multiple devices
- **Training engine** — runs in `packages/training-engine`, imported directly by `apps/parakeet`
- **No backend server** — no Cloud Run, no Fastify, no custom API

## Rationale

### Pros

- Free tier is sufficient (500MB DB, unlimited Realtime, 50K auth users)
- Zero operational burden — no VMs, containers, or servers to manage
- Training engine runs on-device: works fully offline, zero network latency for JIT generation
- Supabase Row Level Security (RLS) handles data isolation between users
- Supabase CLI manages migrations locally, same workflow as any Postgres setup
- Eliminates 3 ADRs worth of infrastructure decisions (Cloud Run, Cloud SQL, CI/CD deployment)
- Supabase SDK (`@supabase/supabase-js`) has first-class Expo/React Native support
- Auth with Google supported natively

### Cons

- Training engine logic lives in the client app (violates the original "no logic on frontend" rule — acceptable since the engine is pure domain logic with no secrets)
- If the app ever expands to more users, Supabase Pro ($25/month) or migration to a custom backend would be needed
- Supabase free tier pauses after 1 week of inactivity — need to either upgrade or use `supabase-js` keepalive ping

## Alternatives Considered

### Alternative 1: Keep GCP (simplified)

- Drop scaling features (Cloud Armor, Pub/Sub, read replicas) but keep Cloud Run + Cloud SQL
- **Why not chosen:** Still requires managing containers, a server, and CI/CD deployment. ~€10-20/month cost. Supabase is free and requires zero server management.

### Alternative 2: Fully local (SQLite, no sync)

- No backend, data stays on device only
- **Why not chosen:** Users need cross-device access to their data. Without any backend, data is locked to one device. Supabase provides cross-device sync with minimal overhead.

### Alternative 3: Firebase (Firestore + Firebase Auth)

- Already in consideration via ADR-002 (Firebase Auth was the original auth choice)
- **Why not chosen:** Firestore's NoSQL model is a poor fit for relational powerlifting data (programs → sessions → session_logs with foreign keys, time-series queries). Supabase Postgres gives us full SQL with the same Google/Apple auth support.

## Consequences

### Positive

- `apps/api` directory eliminated entirely — ~40% of planned codebase removed
- `packages/api-client` eliminated — no custom HTTP client needed
- `packages/db` eliminated — Supabase handles migrations via its CLI
- CI/CD simplified: only EAS Build (parakeet) and Supabase migrations, no container registry or deployment pipeline
- Training engine moves to the app: JIT generation runs instantly with no network round-trip
- Cost: $0/month on free tier

### Negative

- Supabase free tier pauses DB after 7 days inactivity — mitigate with `supabase-js` keepalive or upgrade to Pro when used regularly
- Cannot add backend-only logic without introducing a Supabase Edge Function (Deno-based) or upgrading
- Client-side engine means formula logic is visible in the app bundle (acceptable — no proprietary secrets in the training logic)

### Neutral

- Supabase migrations are SQL files managed locally and pushed via `supabase db push` — same mental model as Flyway/node-pg-migrate

## Implementation Notes

**Supabase project setup:**

```bash
npm install -g supabase
supabase login
supabase init                          # creates supabase/ directory at workspace root
supabase db start                      # local Postgres for development
supabase db push --db-url $PROD_URL   # push migrations to hosted Supabase
```

**parakeet SDK setup:**

```bash
npm install @supabase/supabase-js
```

**Supabase client (`apps/parakeet/lib/supabase.ts`):**

```typescript
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
```

**Free tier keepalive (prevents DB pausing):**
Add a simple `supabase.from('users').select('id').limit(1)` ping on app foreground if last ping was >5 days ago.

## References

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase with Expo](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- [Supabase Free Tier Limits](https://supabase.com/pricing)
- ADR-002: Expo and React Native
