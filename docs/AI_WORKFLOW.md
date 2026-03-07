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

**Separate orchestration files for cross-cutting concerns** — when the same "build + persist" pattern appears in two different service files (e.g., program creation and lazy session generation both building the same DB row shape), extract it into a dedicated file before it drifts further. Name it after the domain concept, not the service that first needed it (e.g., `unending-session.ts`, not `program-session-helper.ts`). The right module home is the one that owns the data (the counter lives on the program row → `modules/program/application/`).

**Refactors need specs too** — structural refactors (consolidating duplicated logic) warrant a brief spec update even if no user-visible behavior changes. Update the existing spec to reflect the new file and call site, and note the refactor in IMPLEMENTATION_STATUS.md.

**Audit all mode-unaware code paths when adding a new program mode** — when a new mode is introduced (e.g., `unending`), systematically grep for every place that makes a completion-percentage or session-count decision. Achievement detection hooks, notification logic, and "show completed session" queries are all candidates that may not be in the same module as the core mode logic. A missed guard produces subtle wrong-behaviour bugs (spurious badges, blocked next-session generation) that only surface at runtime.

**The "return completed session as today's session" pattern needs mode-awareness** — `fetchTodaySession` returning completed sessions within 24h is correct for scheduled mode (shows the user what they did today) but blocks lazy generation in unending mode (prevents training again the same day). Whenever a query has this "show recent completed" behaviour, consider whether it needs a mode branch in the service layer rather than in the query itself.

**Strip-then-insert patterns silently discard data** — when a field (e.g. `is_completed`) is stripped before a DB insert, make sure the filter happens _before_ the strip. The pattern `rows.map(({ flag, ...rest }) => rest)` stores everything; the correct pattern is `rows.filter(r => r.flag).map(({ flag, ...rest }) => rest)`. The bug here was that all sets (including skipped ones) were persisted because the filter was missing; only the strip was present. The `completion_pct` derived stat was correct because it used `is_completed` before the strip — a useful signal that the bug is in the persistence path, not the calculation.

**Feature requests often surface latent data bugs** — "show only completed sets" in the history view was blocked not by a display bug but by incorrect data at the source. Always trace the display problem back to the write path before adding view-layer filters. A view-layer filter (e.g. `reps_completed > 0`) is a wrong fix here because skipped sets retain the planned rep count.

**SDK version mismatches across workspace packages** — when the same SDK (e.g. `@ai-sdk/openai`) exists in multiple workspace packages at different major versions, the type systems are incompatible. The app had `@ai-sdk/openai@1.x` (produces `LanguageModelV1`) while `ai@6.x` expects `LanguageModelV2`. Fix: reuse the model instance from the package that has the compatible version (export `JIT_MODEL` from training-engine) rather than duplicating the model creation. Always check `npm ls <pkg>` before adding AI SDK calls in a new location.

**Update docs at the end matches reality** — the AI workflow step 5 ("Wrap Up") correctly requires updating design/spec/status docs _after_ implementation, not before. The plan file captures intent; the spec captures what was actually built. These often diverge (e.g., file locations change due to module architecture, type issues force different import patterns). Always re-read the actual code before writing the final spec.

**Cross-module AI calls should share model instances** — rather than creating a new OpenAI client in each service file, export model constants from a central location (`training-engine/src/ai/models.ts`). This prevents version drift, ensures consistent model selection, and avoids duplicate API key resolution.

**features.md as an agent task queue** — `docs/todo/features.md` serves as a task queue for AI agents. Each feature is a numbered item with user-voice description. The agent reads the list, picks the next item, implements it following the full AI workflow (orient → design → plan → implement → validate → wrap up), and updates docs. The file header contains standing instructions that remind the agent to update docs at the end and review the process for workflow improvements.

**Small UI features need no spec-first ceremony** — for simple, self-contained UI additions (a button, a modal, a store action with no DB changes), going straight to implement → typecheck → doc is faster than design → spec → implement. Skip the design doc draft if the feature fits in a sentence. Write the spec _after_ to record what was actually built.

**"Work logged anyway" pattern for ad-hoc data** — when adding anything that rides existing save paths (e.g. ad-hoc sets flowing through the `auxiliarySets` → `completeSession` pipeline), verify the destination payload is unfiltered before building the feature. If it is, no new API surface is needed — just UI + a store action.

**Extract modal components immediately** — any modal with its own text input, local state, and button logic is a natural component boundary. If you write it inline, extract it in the same session before committing. The rule: if it has its own `useState`, it should be its own component.

**Match the tool to the scope** — a one-time admin operation (CSV import, data migration, backfill) does not need a mobile UI. A CLI script is faster to build, easier to reason about, and carries no ongoing maintenance cost. Ask: who runs this, how often, and is it reversible? If the answer is "one person, once, manually" — make it a script.

**Read the actual data before designing the format** — the design doc assumed Strong CSV format, but the real file used a completely different schema (NextSet). Always check the actual input before finalising a parser. In a features.md workflow, if a file path is provided, scan it immediately during Orient rather than waiting until implementation.

**Auto-detect formats over flag switching** — when a script may need to handle multiple input formats, detect from the header row rather than requiring a `--format` flag. Fewer args = less user error. A `detectFormat(header)` function is cheap and makes the common case zero-config.

**Nullable schema columns need three-file updates** — making a DB column nullable requires: (1) migration, (2) `supabase/types.ts` hand-edit, (3) grep every call site for non-null assumptions. For `sessions.program_id`, the cascade hit `fetchOverdueScheduledSessions` (inner join guarantees non-null → `!` assertion) and `jit.ts` (JIT never runs on import sessions → `!` assertion). Always grep the column name across the full codebase before declaring done.

**Sentinel values need constraint updates** — when using a new enum-like value as a sentinel (e.g., `intensity_type = 'import'`), check whether the column has a DB CHECK constraint and update it in the same migration. Forgetting this produces a runtime error, not a TypeScript error.\*\*

**`createClient` without Database generic resolves to `never` table types** — in CLI scripts outside the app build system, `createClient()` (without type params) gives a client where all `.from()` calls produce `never`. Fix: `createClient<any>()` and cast the client to `any` inside the insert function. The alternative (importing Database from `supabase/types.ts`) requires tsconfig path resolution that CLI scripts don't have.
**Unify AsyncStorage keys across related UI** — when two UI components independently persist the same logical setting (e.g., bar weight in `PlateCalculatorSheet` and a new settings toggle), they must share one key. One source of truth in AsyncStorage, one set of get/set helpers in the settings module. Diverging keys cause silent divergence: the user sets 15 kg in one place and sees 20 kg in another.

**Default params over guard clauses for backward-compatible engine changes** — when adding a configuration parameter to a pure function (e.g., `barWeightKg`), use a default argument (`barWeightKg = 20`) rather than null checks or overloaded signatures. This keeps all existing call sites and tests passing with zero changes. Reserve null-checking for parameters that are genuinely optional at runtime (user-supplied data that may be absent).

**Formula estimates make "pending" screens useful** — for screens that show an upcoming but not-yet-generated session, run the same deterministic formula the JIT will use (same function, same inputs) to produce an estimate. Label it clearly as an estimate. This turns a nearly-empty card into actionable information without adding any new API surface or async work beyond what was already needed.**Grep for literal magic numbers before treating them as "just a constant"** — `20` in this codebase appeared in four separate files as the bar weight. A search for the number alone is noisy; search for the concept (`bar`, `barKg`, `Math.max.*20`) across the relevant packages before writing the first line of code. This surfaces all the places the new parameter must reach.
**Verify column names against migrations, not sibling query files** — when writing a new Supabase query that references columns not yet used elsewhere in the file, always verify against the migration SQL (`supabase/migrations/`), not against other TypeScript query files. A silently wrong column name (e.g. `scheduled_date` vs `planned_date`) causes the query to return no data with no error thrown — the result is just an empty array.

**Dashboard Timeline is the canonical aggregation — update it with every new page** — `Logs.tsx` is the unified AI event feed. When adding any new dashboard page backed by its own table, also add it to the Timeline's `Promise.all`, `typeConfig`, `Stats`, and `StatCard`. Omitting this means the Timeline shows 0 for that event type while the detail page shows data. See `docs/design/dashboard.md` for the full checklist.

**`JsonViewer` with `defaultCollapsed={true}` and no `label` is permanently hidden** — the component initialises `open = !defaultCollapsed = false` and only renders a toggle when `label` is set. Without a label and with `defaultCollapsed=true` (the default), the content is invisible with no UI escape hatch. Always pass either a `label` prop or `defaultCollapsed={false}` when the viewer must show content immediately.

**LLM personalisation needs real performance numbers, not just categorical tags** — a motivational message context with only categorical metadata (RPE bucket, performance vs plan, PR boolean) gives the LLM nothing specific to reference. Include actual numbers: `topWeightKg` (max weight across sets), `totalSetsCompleted`, `completionPct`. The source for these is `session_logs.actual_sets` (JSONB array) and `session_logs.completion_pct`. Convert grams to kg at the service layer before passing to the LLM.

**Bug reports are two-part: DB write path + UI refresh path** — when a user reports "it still shows X after I did Y", check two things: (1) did the write actually change the DB? and (2) did the UI query get invalidated after the write? Missing cache invalidation after a mutation is the most common cause of "stale UI" bugs. Always pair every mutation with `queryClient.invalidateQueries` for every query key whose data it changes.

**Status indicators need both a dot and a text label** — a coloured dot conveys "something is different" but not "what is different". Red dots for `skipped`, `missed`, and `in_progress` (before the "Active" badge was added) are indistinguishable. Add a text pill badge alongside any dot that represents a non-obvious terminal state. The rule: if a user would need to remember a colour legend, add a label.

**GH issues are a signal to check spec gaps, not just code bugs** — when a bug report arrives, trace it back to the spec. If the spec doesn't mention the missing behaviour (e.g., no text badge for skipped sessions, no query invalidation requirement), update the spec so the same gap can't appear again in future implementations or AI agent runs.**

**Docs-first for new architectural concepts, code-first for UI wiring** — when a feature introduces a new concept (exercise type taxonomy, muscle mapping system), writing the design doc and spec before implementing is valuable: it surfaces scope decisions (which exercises are 'timed'? what does 'bodyweight' mean for loaded variants?) that would otherwise be resolved ad-hoc in code. For straightforward UI wiring (add a prop, conditionally render), skip the doc draft and write the spec after implementation.

**Check all sibling files that implement the same interface** — when adding a required field to a shared interface (`AuxiliaryWork.exerciseType`), grep for all files that construct that type, not just the primary one. `llm-jit-generator.ts` constructed `AuxiliaryWork` objects independently of the formula generator and was missed until the typecheck caught it. The rule: required interface fields require a codebase-wide grep for every construction site.

**`bugs.md` items are often pre-conditions for features** — Bug 1 (exercise types) was a prerequisite for the JIT auto-augment feature. Resolving the bug first created the `ExerciseType` system that the JIT augment logic will need to filter its exercise candidates. Check the bugs list before planning a new feature — the bug fix may be the right first step.
