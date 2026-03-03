# Modules Architecture

This folder is the feature-first app architecture for Parakeet.

## Intent

- Keep `src/app` as routing/composition only.
- Keep business capabilities in feature modules.
- Give each feature one clear home and a public API.

## Folder shape

Each feature module should follow:

```text
modules/<feature>/
  ui/            # feature UI components
  hooks/         # feature-specific React hooks
  application/   # use-cases/orchestration (business logic)
  data/          # repositories and persistence boundaries
  model/         # feature-local types/value objects
  index.ts       # public exports for consumers
```

## Layering rules

- Preferred dependency direction:
  - `ui -> hooks -> application -> data -> platform`
- `application` can depend on:
  - module `data`
  - `@parakeet/training-engine`
  - `@parakeet/shared-types`
  - `@shared/*` / `@platform/*` utilities
- `data` owns DB/network JSON boundary parsing.
- `ui` should not import repositories directly.

## Public API rules

- Consumers should import module APIs from:
  - `@modules/<feature>`
- Avoid deep imports like:
  - `@modules/<feature>/application/...`
- Add exports to `<feature>/index.ts` as the stable entrypoint.

## Platform and shared

- Infra/shared concerns are outside modules:
  - `@platform/*` for supabase/network/query/storage
  - `@shared/*` for app-wide shared ui/utils/types/constants

## Current status

- Module/platform/shared architecture is the canonical app structure.
- Legacy top-level folders (`lib`, `services`, `data`, `hooks`, `queries`, `network`, `store`, `utils`, `types`) have been removed.
- New code should use `@modules/*`, `@platform/*`, and `@shared/*`.

## For next agent

When adding or refactoring features:

1. Prefer module public APIs (`@modules/<feature>`).
2. Keep infra/runtime code in `@platform/*`.
3. Keep reusable cross-feature code in `@shared/*`.
4. Keep typecheck and boundaries green:
   - `tsc --noEmit -p apps/parakeet/tsconfig.typecheck.json`
   - `npm run check:module-boundary`
