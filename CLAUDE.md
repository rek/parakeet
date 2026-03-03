Be concise.

## Canonical Entry Point

Start with [docs/README.md](./docs/README.md). It links to architecture, workflow, and coding standards.

## Required Reading Order

1. [docs/PROJECT_ORGANIZATION.md](./docs/PROJECT_ORGANIZATION.md)
2. [docs/CODE_STYLE.md](./docs/CODE_STYLE.md)
3. [docs/AI_WORKFLOW.md](./docs/AI_WORKFLOW.md)
4. [docs/dev.md](./docs/dev.md)

## Architecture Baseline

- App uses module-first architecture in `apps/parakeet/src/modules`.
- `app/` is routing/composition only.
- `platform/` is infra only.
- `shared/` is cross-feature reusable code.
- Prefer module public APIs: `@modules/<feature>`.

## Validation Baseline

Before handoff for app refactors:

- `tsc --noEmit -p apps/parakeet/tsconfig.typecheck.json`
- `npm run check:module-boundary`
