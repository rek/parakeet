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

For the dashboard app:

- `tsc --noEmit -p apps/dashboard/tsconfig.app.json`
- `npx nx lint dashboard`

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
3. Update `docs/IMPLEMENTATION_STATUS.md` — new checklist entries, corrected test counts, new migrations.
4. Update `supabase/types.ts` if you added migrations without running `npm run db:types` (see dev.md).
5. Review these workflow docs for any learnings and update them.

## Prompt Starter

```text
Implement <feature/change> using docs/PROJECT_ORGANIZATION.md and docs/CODE_STYLE.md.
Start by creating/updating:
1) docs/design/<name>.md
2) docs/specs/<id>-<name>.md
Then implement in small slices with validation after each slice.
At the end: update design doc status, finalize specs, update IMPLEMENTATION_STATUS.md.
```

## Key Learnings

**Design before spec before implement** — the user review pass between design doc and spec catches cross-mode regressions before any code is written. Don't skip it.

**Nullable schema columns cascade** — making a DB column nullable (e.g., `total_weeks`) requires updating: the migration, `supabase/types.ts`, Zod schemas in `shared-types`, domain types in `shared/types/domain.ts`, and every call site that assumed the value was always present. Grep for the column name before starting.

**`supabase/types.ts` must be kept in sync with migrations** — `npm run db:types` is the correct path. If local Supabase is not running, hand-edit cautiously and note it for the next `db:reset` run.

**Lazy generation pattern for unending modes** — check for an existing record first, then generate and persist only if missing. Never generate unconditionally or you'll duplicate rows across concurrent requests.

**Regression guards to write first** — before implementing unending logic, write the guards that prevent regressions in the scheduled path: `fetchOverdueScheduledSessions` filtering by `program_mode`, `completeSession` checking `program_mode` before the 80% gate. Write these before the feature code so they're in place from the start.
