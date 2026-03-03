# AI Workflow

Use this process for non-trivial work.

## 0) Orient

Before any design or implementation:

- Check [FEATURE_MAP.md](./FEATURE_MAP.md) to find relevant modules and their paths.
- Check [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) to see what's already built.
- Check `apps/parakeet/src/modules/<feature>/index.ts` for the current public API before adding new exports.

## 1) Design

- Create/update a design doc in `docs/design/`.
- Use `docs/design/_TEMPLATE.md`.
- Focus on problem, constraints, architecture impact, rollout.

## 2) Plan

- Create/update implementation tasks in `docs/specs/`.
- Keep tasks small and ordered.
- Note unresolved questions explicitly.

## 3) Implement

- Follow boundaries in `docs/PROJECT_ORGANIZATION.md`.
- Prefer module public APIs (`@modules/<feature>`).
- Keep infra in `@platform/*`; cross-feature code in `@shared/*`.
- Avoid introducing legacy top-level folders.

## 4) Validate

For app refactors, run:

- `tsc --noEmit -p apps/parakeet/tsconfig.typecheck.json`
- `npm run check:module-boundary`

Add targeted tests when moving logic or changing behavior.

## Prompt Starter

```text
Implement <feature/change> using docs/PROJECT_ORGANIZATION.md and docs/CODE_STYLE.md.
Start by creating/updating:
1) docs/design/<name>.md
2) docs/specs/<id>-<name>.md
Then implement in small slices with validation after each slice.
```
