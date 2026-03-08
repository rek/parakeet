Be concise.

## System Intent

Read [docs/intent.md](./docs/intent.md) first — system goals and philosophy.

## Canonical Entry Point

[docs/README.md](./docs/README.md) links to architecture, workflow, and coding standards.

## Feature & Bug Work

To work on a feature or bug: read `docs/backlog.md` — each entry links to its design and spec docs.

## Required Reading (on-demand)

| Doc                                                                   | When to read             |
| --------------------------------------------------------------------- | ------------------------ |
| [guide/project-organization.md](./docs/guide/project-organization.md) | Adding files or modules  |
| [guide/code-style.md](./docs/guide/code-style.md)                     | Writing code             |
| [guide/ai-workflow.md](./docs/guide/ai-workflow.md)                   | Non-trivial features     |
| [guide/dev.md](./docs/guide/dev.md)                                   | Running/building/testing |

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
