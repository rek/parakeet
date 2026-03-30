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

## Data Layer

Server state is managed by React Query. See [docs/guide/react-query-patterns.md](../../docs/guide/react-query-patterns.md) and [docs/guide/project-organization.md](../../docs/guide/project-organization.md#data-layer) for full reference.

- **New code**: define `queryOptions` factories in `modules/*/data/*.queries.ts` — key and queryFn co-located.
- **Existing code**: uses centralized `qk` helper from `@platform/query/keys.ts` (legacy, migrate when touched).
- No raw query key arrays — use `queryOptions` factories or `qk` helper.
- Every mutation must `invalidateQueries` for affected query keys.
- Hooks exist only when they add auth, aggregation, or config beyond `queryOptions`.

## Critical Invariants

- JSON parsing belongs in `modules/*/data/` codecs, not in screens.
- AsyncStorage writes in event handlers must be `await`ed with try/catch + `captureException`.
- `@ai-sdk/openai` version mismatch: app has v1.x, engine has v3.x. Import `JIT_MODEL` from `@parakeet/training-engine`.

## Validation

Run `/verify` — it checks typecheck, boundaries, and tests.
