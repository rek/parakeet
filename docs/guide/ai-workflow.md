# AI Workflow

Use this process for non-trivial work.

## Documentation Layers

Each layer has a single purpose. Know which to read and which to update.

| Layer | Path | Purpose | When to read | When to update |
|-------|------|---------|-------------|----------------|
| **Intent** | `docs/intent.md` | Why the app exists, design philosophy | First read of any session | Rarely — only if core goals change |
| **Domain** | `docs/domain/` | Training science truth: constants, formulas, research ranges | Validating values, reviewing correctness, adding/changing engine constants | Any time a training constant changes |
| **Guides** | `docs/guide/` | How to work: code style, project org, dev commands, workflow | Before writing code | When process or conventions change |
| **Features** | `docs/features/*/` | Feature-centric docs: each dir has `index.md` (status), `design*.md` (rationale), `spec-*.md` (implementation plans) | Before implementing a feature | After implementing (mark done, update to match reality) |
| **ADRs** | `docs/decisions/` | Architectural choices and tradeoffs | When revisiting a past decision | When making a new architectural choice |
| **Status** | Each `docs/features/*/index.md` | What's built vs planned per feature | Before starting any work | After every feature/bugfix |

### Key rule: domain constants live in `docs/domain/` only

Specs and design docs must **link to** domain docs for values — never duplicate them. When a training constant changes, update `docs/domain/` and the engine code. Specs reference domain docs, not the other way around.

### When to skip a design doc

A design doc is warranted for genuinely new architecture: new program modes, new data models, new AI strategies. For features under ~5 files that extend existing systems (new screen, new modifier, value tuning), go straight to spec + domain update.

## 0) Orient

Before any design or implementation:

- Check [README.md](../README.md) to find relevant modules and their paths.
- Check `docs/features/*/index.md` to see what's already built for the relevant feature.
- Check [domain/](../domain/) if the work involves training constants or formulas.
- Check `apps/parakeet/src/modules/<feature>/index.ts` for the current public API before adding new exports.

**When debugging a bug:** Check two paths — (1) did the DB write actually land? and (2) did the UI query get invalidated? Missing cache invalidation is the most common cause of "stale UI" that passes write-path inspection.

## 1) Research (big features only)

When the work touches a new technology, library, or domain the codebase hasn't used before:

- Investigate feasibility: what libraries exist, what's proven, what's experimental.
- Read documentation, check React Native / Expo compatibility, find prior art.
- Document findings in the design doc under a **Research** section.
- Identify hard constraints early (e.g., "MediaPipe only works via native module, not Expo Go").

Skip for features that extend familiar technology.

## 2) Discuss (grill)

Walk down each branch of the decision tree **one question at a time**. For each question, provide a recommended answer with reasoning. If the codebase can answer a question, read the code instead of asking.

**Do not move to Design until every branch is resolved.**

The goal is to surface every gray area, ambiguity, and tradeoff before committing to a design. Decisions accumulate in the design doc under a **Decisions** section.

Examples of what to resolve:
- Architecture: on-device vs server? New module vs extend existing?
- Scope: what's Phase 1 vs Phase 2? What's explicitly out of scope?
- Data: what's stored, where, what format? What happens to old data?
- UX: what does the user see, when, how do they trigger it?
- Dependencies: new libraries? Native modules? Expo compatibility?
- Edge cases: what happens when X fails? What about slow devices?

For small features (bug fixes, value changes, <5 files), skip to Plan.

## 3) Design

Only for new architectural concepts (new program mode, new data model, new AI strategy, new technology integration):

- Create a design doc in `docs/features/<feature>/design.md`.
- Use `docs/features/_TEMPLATE/design.md`.
- Include **Research** findings and **Decisions** from the Discuss step.
- Focus on problem, constraints, architecture impact, rollout.
- Link to `docs/domain/` for any training science values — do not restate them.

For smaller features, skip to Plan.

## 4) Plan (phased for big features)

- Create/update implementation tasks in `docs/features/<feature>/spec-*.md`.
- Keep tasks small and ordered.
- Reference `docs/domain/` for constants — specs describe *where* values are used, not *what* they are.
- **Confirm scope before building** — if a task involves external systems (cloud upload, third-party APIs, new permissions), confirm with the user that the scope is wanted before implementing. Building then reverting wastes effort.
- **Prioritize by architectural value, not by ease** — never say "lowest-hanging fruit" or "easiest win." Order tasks by what delivers the most complete, well-structured system.

For big features, break the spec into **numbered phases**. Each phase should be independently shippable and verifiable. Structure:

```
Phase 1: <name> — <what it delivers>
  - [ ] Task 1.1
  - [ ] Task 1.2

Phase 2: <name> — <what it delivers>
  - [ ] Task 2.1
  ...
```

Phases execute sequentially. Tasks within a phase can run in parallel if independent.

## 5) Execute (per phase)

For each phase:

**Before writing code for a screen, verify:**
- Query keys match `qk.*` patterns
- Mutations invalidate relevant queries
- Props flow all context the child components need

A pre-implementation screen review catches issues (stale query keys, missing invalidations, prop threading) that would otherwise ship alongside the new feature.

- **Fresh context**: Start each phase with a clean agent/session. Provide only the phase's tasks, relevant files, and decisions — not the entire conversation history. This prevents context degradation on big features.
- Follow boundaries in `project-organization.md`.
- Prefer module public APIs (`@modules/<feature>`).
- Keep infra in `@platform/*`; cross-feature code in `@shared/*`.
- Commit after each task or logical unit. One concern per commit.

### Native module phases

When a phase adds native dependencies (MediaPipe, vision-camera, etc.):

- **Install deps first, then detail the plan** — install packages, inspect the actual type definitions, then write the implementation plan. Documented APIs often differ from reality; having the real `.d.ts` files locally avoids wasted design time.
- **State the prebuild requirement in the plan** — native deps require `npx expo prebuild` + a new dev client build before they work on device. Include this as an explicit step so the user knows when to trigger a build.
- **Add to both package.json files** — `apps/parakeet/package.json` (for autolinking) and root `package.json` (for hoisting). Missing either causes subtle failures.
- **Update Zod schemas in the same commit as computed fields** — `satisfies` doesn't catch excess properties from `.map()` chains. If the assembler produces a field, the schema must include it, or it's silently dropped on typed reads.

### Zero tolerance for type hacking

**`as any`, `as unknown as X`, and hand-written DB row types are never acceptable — not even temporarily.** They are symptoms of skipped steps, not solutions.

When you hit a type error:
1. **Stop.** Don't cast around it.
2. **Fix the source.** If Supabase types are missing, run `npm run db:types` now. If the migration hasn't been pushed, push it now. If the LLM parameter type is wrong, fix the type definition now.
3. **If you can't fix the source in this step**, you are working in the wrong order. Back up, fix the prerequisite, then continue.

A cast makes the compiler trust you. If you're wrong, the runtime breaks silently. A cast that gets copied across 3 files becomes systemic type blindness. Maximum fidelity means the type system is an ally, not an obstacle to route around.

**When touching DB schema:**
- Grep the column name across the full codebase before starting — making a column nullable cascades to: migration, `supabase/types.ts`, Zod schemas in `shared-types`, and domain types in `shared/types/domain.ts`.
- If using a new enum-like sentinel value, check for a DB CHECK constraint and update it in the same migration.
- Always verify column names against the migration SQL, not sibling query files — a silently wrong column name returns no data with no error thrown.
- After every migration: run `npm run db:types` immediately. Not as a follow-up. Not in wrap-up. Immediately. Then verify the generated types match your expectations before writing repository code.

### Inline quality checks during execution

Don't defer all quality checks to a post-hoc arch review. Check these during implementation:

- **Dead parameters**: if a function parameter isn't used in the body, remove it.
- **Theme compliance**: no raw hex colors — use `colors.*` from `ColorScheme`.
- **Unsafe casts**: if you write `as any` or `as unknown as X`, stop and fix the root cause. No exceptions.
- **Error surfacing**: every async error path needs `captureException` + `Alert` (per project convention).
- **Schema alignment**: when a pure function produces fields, verify they exist in the Zod schema that validates the output.
- **DB types**: after pushing a migration, regenerate types before writing queries. Never hand-write DB row interfaces.
- **Spec link**: add `// @spec docs/features/<f>/spec-<name>.md` at the top of each new non-trivial module file. See [spec-linking.md](./spec-linking.md).

## 6) Verify (per phase)

After each phase, verify before moving to the next:

**Automated checks:** Run `/verify` (typecheck, boundaries, tests, lint).

**Manual checks:**
- Walk through the user-facing flow on device/simulator.
- Test edge cases identified during Discuss.
- Confirm the phase delivers what was planned.

If verification fails, fix before advancing. Do not accumulate debt across phases.

For the dashboard app:
- `tsc --noEmit -p apps/dashboard/tsconfig.app.json`
- `npx nx lint dashboard`

Dashboard conventions:
- Theme: all colours/borders must use `src/lib/theme.ts` constants or CSS vars from `src/styles.css`; no raw `rgba()`/hex in component files
- Interactive divs: use `<button className="btn-reset">` not `<div onClick>`
- Env switching: `SupabaseContext` — all components get `supabase` via `useSupabase()`, add to `useEffect` deps

## 7) Wrap Up

After all phases complete:

1. Update `docs/domain/` if any training constants were added or changed.
2. Update spec files to match what was actually built (not what was originally planned). For each ticked task, add a `→ path:symbol` back-link per [spec-linking.md](./spec-linking.md).
3. Update the feature's `index.md` frontmatter status and spec table.
4. Update design doc status from **Draft** → **Implemented** (if one exists for this work).
5. Update `supabase/types.ts` if you added migrations without running `npm run db:types` (see dev.md).
6. Review [ai-learnings.md](./ai-learnings.md) for any new patterns worth capturing.
7. Close any associated GitHub Issues or remove items from backlog.md.

## Flow Summary

**Small features** (bug fixes, <5 files, familiar tech):
```
Orient → Plan → Execute → Verify → Wrap Up
```

**Big features** (new architecture, new tech, multi-phase):
```
Orient → Research → Discuss (grill) → Design → Plan (phased) → [per phase: Execute → Verify] → Wrap Up
```

## Prompt Starter

```text
Implement <feature/change> using docs/guide/project-organization.md and docs/guide/code-style.md.
Check docs/domain/ for relevant training science constants.
Create/update docs/features/<feature>/spec-<name>.md as an implementation plan.
Then implement in small slices with validation after each slice.
At the end: update domain docs (if constants changed), finalize specs, update feature index.md.
```
