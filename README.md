# Parakeet

Personal powerlifting training system. Track, train, improve.

## What It Is

A Cube Method program generator and session tracker. The training engine runs locally in the app (no backend). Supabase handles auth, data storage, and cross-device sync. An LLM layer augments the rule-based engine for session adjustment and end-of-cycle coaching — the system improves automatically as models improve.

## Tech Stack

- **Expo SDK 54**, React Native, TypeScript
- **Nx monorepo** — `apps/parakeet`, `packages/training-engine`, `packages/shared-types`
- **Supabase** — Auth (Google OAuth) + Postgres + Realtime
- **Vercel AI SDK** (`ai` + `@ai-sdk/openai`) — JIT adjustments, cycle reviews, motivational messages

## Quick Start

```bash
npm install
npm run db:start          # Local Supabase
nx run parakeet:start     # Expo dev server
```

See `docs/guide/dev.md` for full dev setup, build, sideload, and testing commands.

## Documentation

Start here:

1. `docs/intent.md` — system vision and design philosophy
2. `docs/README.md` — central docs index and feature navigator
3. `docs/guide/project-organization.md` — canonical structure and boundaries
4. `docs/features/core-engine/design-architecture.md` — full system overview and AI strategy

## Testing

```bash
nx run-many -t test       # All tests
nx affected -t test       # Only affected by current branch
nx run training-engine:test  # Single package
```
