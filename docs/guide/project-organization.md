# Project Organization

Canonical architecture reference for this repo.

## Monorepo Layout

- `apps/parakeet` - Expo app
- `packages/training-engine` - Pure domain/training logic
- `packages/shared-types` - Shared type/schema contracts
- `supabase` - Generated types + migrations

## App Layout (`apps/parakeet/src`)

- `app/` - Expo Router shell/screens (compose module APIs only)
- `modules/` - Feature duck modules (domain/business behavior)
- `platform/` - Technical infrastructure (supabase/query/network/storage/runtime)
- `shared/` - Cross-feature app utilities/types/constants/ui
- `components/` - Cross-cutting UI (ErrorBoundary, BackLink); feature-scoped components belong in `modules/*/ui/`
- `theme/` - Design tokens/style primitives

## Module Shape

`modules/<feature>/`

- `application/` - orchestration/use-cases
- `data/` - repositories (`*.repository.ts`) and query definitions (`*.queries.ts`)
- `hooks/` - feature hooks
- `lib/` - module public utilities/contracts
- `model/` - feature-local model/types
- `ui/` - feature-scoped React components, presentation constants, and styles
- `utils/` - pure functions extracted from components (testable, no React deps)
- `index.ts` - module public API

## Data Layer

Data flows through four layers. Each has a single responsibility.

```
Component / Screen
  └→ Hook (useQuery / useMutation + auth/aggregation glue)
       └→ Service (orchestration, business rules, cross-module calls)
            └→ Repository (Supabase queries, normalization)
                 └→ Supabase Client
```

### Where things live

| File | Location | Responsibility |
|------|----------|---------------|
| `*.repository.ts` | `modules/*/data/` | Supabase queries, row normalization, type parsing. **Private** to the module — never exported via `index.ts`. |
| `*.queries.ts` | `modules/*/data/` | `queryOptions` factories (key + queryFn co-located). Exported via module `index.ts`. |
| `*.service.ts` | `modules/*/application/` | Orchestration: coordinates repositories, applies business rules, calls other module services. |
| `use*.ts` | `modules/*/hooks/` | Thin React Query wrappers. Only exists when it adds logic beyond the `queryOptions` — e.g. `useAuth()`, multi-query aggregation, `select`, `refetchInterval`. |

### Query definitions (`*.queries.ts`)

Each module owns its query keys and functions via `queryOptions` factories:

```ts
// modules/program/data/program.queries.ts
import { queryOptions } from '@tanstack/react-query'
import { getActiveProgram } from '../application/program.service'

export const programQueries = {
  all:    () => ['program'] as const,
  active: (userId: string) => queryOptions({
    queryKey: [...programQueries.all(), 'active', userId] as const,
    queryFn:  () => getActiveProgram(userId),
  }),
}
```

These replace the centralized `qk` key registry in `platform/query/keys.ts` (legacy — still used in existing code, but new code should define queries in the module's `data/` folder).

### When a hook earns its existence

A hook is justified when it adds **real logic** beyond what `queryOptions` provides:

- Resolves auth context (`useAuth()` → userId)
- Aggregates multiple queries into one return shape
- Adds per-use-case config (`select`, `refetchInterval`, `placeholderData`)
- Wraps `useMutation` with invalidation + error handling

If a hook is just `useQuery(someQueryOptions)` with no extras, call `queryOptions` directly from the component instead.

### Platform query infrastructure

`platform/query/` owns the `QueryClient`, default options (`staleTime`, `gcTime`, `retry`), and the legacy `qk` key registry. It must not contain feature-specific query definitions.

See [react-query-patterns.md](./react-query-patterns.md) for the full patterns reference.

## Import Boundaries

- Prefer `@modules/<feature>` from app/components.
- `modules` may depend on `@platform/*`, `@shared/*`, `@parakeet/*`.
- `platform` must not depend on feature modules.
- `shared` must stay domain-agnostic or broadly reusable.
- Avoid deep imports into module internals unless inside the same module.

## Legacy Paths

Legacy top-level folders (`lib`, `services`, `data`, `hooks`, `queries`, `network`, `store`, `utils`, `types`) have been migrated. New code should not reintroduce them.

## Routing (`apps/parakeet/src/app/`)

Expo Router shell only — no business logic. Screens compose module APIs.

Key routes:
- `(tabs)/today.tsx` — Today screen (workout card, volume, disruption banners)
- `(tabs)/session/[sessionId].tsx` — Active session logging
- `(tabs)/session/complete.tsx` — Session complete screen
- `(tabs)/session/soreness.tsx` — Pre-session soreness check-in
- `(tabs)/program.tsx` — Program week/block grid view
- `(tabs)/history.tsx` — Performance trends and session history
- `(tabs)/settings.tsx` — Settings hub
- `(auth)/welcome.tsx` — Auth/sign-in
- `(auth)/onboarding/` — Onboarding flow (maxes, program settings, review)
- `formula/editor.tsx` — Formula editor with AI suggestions
- `disruption-report/report.tsx` — Disruption reporting flow
- `history/cycle-review/[programId].tsx` — Post-cycle review
- `history/cycle-patterns.tsx` — Cycle phase history
- `settings/` — Settings sub-screens

## Platform (`apps/parakeet/src/platform/`)

Infrastructure only. No feature business logic.

| Path | Alias | What it provides |
| ---- | ----- | ---------------- |
| `platform/supabase/` | `@platform/supabase` | Supabase client, database types, bootstrap |
| `platform/query/` | `@platform/query` | React Query client, query key registry, default options |
| `platform/network/` | `@platform/network` | Network status hook, JSON codec helpers |
| `platform/store/` | (direct import) | Zustand stores: `sessionStore`, `syncStore` |
| `platform/lib/` | (direct import) | Storage adapter, rest notification scheduler |
| `platform/utils/` | (direct import) | `captureException` wrapper |

## Shared (`apps/parakeet/src/shared/`)

Cross-feature, domain-agnostic utilities and types.

| Path | What it provides |
| ---- | ---------------- |
| `shared/types/domain.ts` | App-layer domain types (mirrors DB shapes for UI use) |
| `shared/types/navigation.ts` | Expo Router typed params |
| `shared/utils/date.ts` | Date formatting helpers |
| `shared/constants/training.ts` | Training constants (lift names, muscle groups, etc.) |
| `shared/network/database.ts` | Shared DB row type helpers |

## Packages

### `@parakeet/training-engine`

Path: `packages/training-engine/src/`
Pure TypeScript. No React, no Supabase.

Contains: 1RM formulas, cube scheduler, loading calculator, program generator, JIT session generator, MRV/MEV calculator, performance adjuster, auxiliary rotator, soreness adjuster, warmup calculator, Wilks formula, cycle phase calculator, PR detection, cycle review generator, hybrid JIT strategy, developer suggestion engine.

Entry: `packages/training-engine/src/index.ts`
Tests: Vitest — `nx run training-engine:test`

### `@parakeet/shared-types`

Path: `packages/shared-types/src/`
Zod schemas and inferred TypeScript types shared between app and engine.

Key schemas: `FormulaOverridesSchema`, `CreateFormulaConfigSchema`, `DisruptionSchema`, `JITAdjustmentSchema`, `CycleReviewSchema`.

Entry: `packages/shared-types/src/index.ts`
