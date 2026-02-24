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

## Development

```bash
npm install
```

### parakeet dev server

```bash
# Start Expo dev server (iOS/Android/Web)
npx nx run parakeet:start

# Then in the Expo CLI menu:
#   Press i  → iOS simulator
#   Press a  → Android emulator
#   Press w  → Web browser (Metro web)

# Or start directly in web mode:
npx nx run parakeet:serve
```

### Linting and type checking

```bash
npx nx run parakeet:lint
npx tsc -p apps/parakeet/tsconfig.app.json --noEmit
```

### Supabase (local)

```bash
npm run db:start                 # Start local Postgres + Studio at localhost:54323
npm run db:reset                 # Apply migrations (drop + recreate)
npm run db:types                 # Generate TypeScript types → supabase/types.ts
npm run db:push                  # Push migrations to hosted Supabase
```
