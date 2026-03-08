# Agent Guardrails

## Docs Entry Point

- Read [docs/intent.md](./docs/intent.md) for system goals and philosophy.
- Start documentation discovery from `docs/README.md`.
- Treat `docs/guide/project-organization.md` as canonical for app/module/platform/shared boundaries.

## Validation

- Before handing off type refactors in `apps/parakeet`, run:
  - `tsc --noEmit -p apps/parakeet/tsconfig.typecheck.json`
- If that fails due to moved exports or schema drift, fix code instead of relaxing types.

Lastly, confirm lint is ok:

- `nx run-many -t lint`
