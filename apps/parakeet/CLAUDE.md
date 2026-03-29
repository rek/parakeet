Module-first Expo/React Native app. Business logic lives in modules, not screens.

## Architecture

- `app/` — routing and composition only. No business logic.
- `modules/<feature>/` — domain behaviour. Import via `@modules/<feature>`.
- `platform/` — infra only (`supabase`, `query`, `network`, `store`). Must not import from `modules/`.
- `shared/` — cross-feature reusable code. Domain-agnostic.

## Module Shape

Each module: `application/` | `data/` | `hooks/` | `lib/` | `model/` | `ui/` | `utils/` | `index.ts`

- Extract business logic from components into `utils/` (pure, testable) or `application/` (orchestration).
- If a `useMemo` does non-trivial domain logic, extract to a named pure function.
- If a component has its own `useState`, it's a component boundary — extract it.

## Critical Invariants

- Query keys must use the canonical `qk` helper from `@platform/query` — no raw arrays.
- Every mutation must `invalidateQueries` for affected query keys.
- JSON parsing belongs in `modules/*/data/` codecs, not in screens.
- AsyncStorage writes in event handlers must be `await`ed with try/catch + `captureException`.
- `@ai-sdk/openai` version mismatch: app has v1.x, engine has v3.x. Import `JIT_MODEL` from `@parakeet/training-engine`.

## Validation

Run `/verify` — it checks typecheck, boundaries, and tests.
