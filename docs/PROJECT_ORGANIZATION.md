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
- `components/` - Transitional UI components (migrating toward `modules/*/ui` or `shared/ui`)
- `theme/` - Design tokens/style primitives

## Module Shape

`modules/<feature>/`

- `application/` - orchestration/use-cases
- `data/` - repositories/persistence boundaries
- `hooks/` - feature hooks
- `lib/` - module public utilities/contracts
- `model/` - feature-local model/types
- `ui/` - feature-scoped presentation constants and styles
- `utils/` - pure functions extracted from components (testable, no React deps)
- `index.ts` - module public API

## Import Boundaries

- Prefer `@modules/<feature>` from app/components.
- `modules` may depend on `@platform/*`, `@shared/*`, `@parakeet/*`.
- `platform` must not depend on feature modules.
- `shared` must stay domain-agnostic or broadly reusable.
- Avoid deep imports into module internals unless inside the same module.

## Legacy Paths

Legacy top-level folders (`lib`, `services`, `data`, `hooks`, `queries`, `network`, `store`, `utils`, `types`) have been migrated. New code should not reintroduce them.
