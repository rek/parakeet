# AI Workflow

Use this process for non-trivial work.

## Documentation Layers

Each layer has a single purpose. Know which to read and which to update.

| Layer | Path | Purpose | When to read | When to update |
|-------|------|---------|-------------|----------------|
| **Intent** | `docs/intent.md` | Why the app exists, design philosophy | First read of any session | Rarely — only if core goals change |
| **Domain** | `docs/domain/` | Training science truth: constants, formulas, research ranges | Validating values, reviewing correctness, adding/changing engine constants | Any time a training constant changes |
| **Guides** | `docs/guide/` | How to work: code style, project org, dev commands, workflow | Before writing code | When process or conventions change |
| **Specs** | `docs/specs/` | Implementation plans: task checklists for multi-file features | Before implementing a planned feature | After implementing (mark done, update to match reality) |
| **Design** | `docs/design/` | Historical feature rationale (what/why) | Understanding why a feature exists | Only for genuinely new architecture (e.g., new program mode) |
| **ADRs** | `docs/decisions/` | Architectural choices and tradeoffs | When revisiting a past decision | When making a new architectural choice |
| **Status** | `docs/specs/implementation-status.md` | What's built vs planned | Before starting any work | After every feature/bugfix |

### Key rule: domain constants live in `docs/domain/` only

Specs and design docs must **link to** domain docs for values — never duplicate them. When a training constant changes, update `docs/domain/` and the engine code. Specs reference domain docs, not the other way around.

### When to skip a design doc

A design doc is warranted for genuinely new architecture: new program modes, new data models, new AI strategies. For features under ~5 files that extend existing systems (new screen, new modifier, value tuning), go straight to spec + domain update.

## 0) Orient

Before any design or implementation:

- Check [README.md](../README.md) to find relevant modules and their paths.
- Check [implementation-status.md](../specs/implementation-status.md) to see what's already built.
- Check [domain/](../domain/) if the work involves training constants or formulas.
- Check `apps/parakeet/src/modules/<feature>/index.ts` for the current public API before adding new exports.

## 1) Design

Only for new architectural concepts (new program mode, new data model, new AI strategy):

- Create a design doc in `docs/design/`.
- Use `docs/design/_TEMPLATE.md`.
- Focus on problem, constraints, architecture impact, rollout.
- Link to `docs/domain/` for any training science values — do not restate them.

For smaller features, skip to Plan.

## 2) Plan

- Create/update implementation tasks in `docs/specs/`.
- Keep tasks small and ordered.
- Note unresolved questions explicitly.
- Reference `docs/domain/` for constants — specs describe *where* values are used, not *what* they are.

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

1. Update `docs/domain/` if any training constants were added or changed.
2. Update spec files to match what was actually built (not what was originally planned).
3. Update `../specs/implementation-status.md` — new checklist entries, corrected test counts, new migrations.
4. Update design doc status from **Draft** → **Implemented** (if one exists for this work).
5. Update `supabase/types.ts` if you added migrations without running `npm run db:types` (see dev.md).
6. Review [ai-learnings.md](./ai-learnings.md) for any new patterns worth capturing.
7. Close any associated Github Issues or remove items from backlog.md

## Prompt Starter

```text
Implement <feature/change> using docs/guide/project-organization.md and docs/guide/code-style.md.
Check docs/domain/ for relevant training science constants.
Create/update docs/specs/<id>-<name>.md as an implementation plan.
Then implement in small slices with validation after each slice.
At the end: update domain docs (if constants changed), finalize specs, update implementation-status.md.
```
