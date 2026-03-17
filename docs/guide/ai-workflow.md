# AI Workflow

Use this process for non-trivial work.

## 0) Orient

Before any design or implementation:

- Check [README.md](../README.md) to find relevant modules and their paths.
- Check [implementation-status.md](../specs/implementation-status.md) to see what's already built.
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

- Follow boundaries in `project-organization.md`.
- Prefer module public APIs (`@modules/<feature>`).
- Keep infra in `@platform/*`; cross-feature code in `@shared/*`.
- Avoid introducing legacy top-level folders.

## 4) Validate

For app refactors, run:

- `tsc --noEmit -p apps/parakeet/tsconfig.typecheck.json`
- `npm run check:module-boundary`

For the dashboard app:

- `tsc --noEmit -p apps/dashboard/tsconfig.app.json`
- `npx nx lint dashboard`

For tests, see [dev.md](./dev.md#testing). Always: `npx nx affected -t test`.

Add targeted tests when moving logic or changing behavior.

## Dashboard-specific conventions

- Lint: `npx nx lint dashboard` — uses oxlint (same as `apps/parakeet`)
- Theme: all colours/borders must use `src/lib/theme.ts` constants or CSS vars from `src/styles.css`; no raw `rgba()`/hex in component files
- Interactive divs: use `<button className="btn-reset">` not `<div onClick>`
- Env switching: `SupabaseContext` — all components get `supabase` via `useSupabase()`, add to `useEffect` deps

## 5) Wrap Up

After implementation:

1. Update design doc status from **Draft** → **Implemented** and add spec file links.
2. Write or update spec files to match what was actually built (not what was originally planned).
3. Update `../specs/implementation-status.md` — new checklist entries, corrected test counts, new migrations.
4. Update `supabase/types.ts` if you added migrations without running `npm run db:types` (see dev.md).
5. Review [ai-learnings.md](./ai-learnings.md) for any new patterns worth capturing.
6. Close any associated Github Issues or remove items from backlog.md

## Prompt Starter

```text
Implement <feature/change> using docs/guide/project-organization.md and docs/guide/code-style.md.
Start by creating/updating:
1) docs/design/<name>.md
2) docs/specs/<id>-<name>.md
Then implement in small slices with validation after each slice.
At the end: update design doc status, finalize specs, update implementation-status.md.
```
