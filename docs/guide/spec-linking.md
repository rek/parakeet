# Spec ↔ Code Linking

Bi-directional traceability between specs (`docs/features/*/spec-*.md`) and code
(`apps/parakeet/src/modules/**`, `packages/training-engine/src/**`).

## Why

- Find code from a spec task without grepping.
- Find the spec rationale from code without digging through commits.
- Catch orphans: spec tasks ticked with nothing shipped, or code with no spec.

## Forward link: spec → code

Completed spec tasks MUST name the implementing file and symbol.

```markdown
- [x] `runJIT(input: JITInput): JITOutput` — orchestrator
  → `modules/jit/application/jit-session-generator.ts:runJIT`
- [x] Unit tests
  → `modules/jit/application/__tests__/jit-session-generator.test.ts`
```

Rules:

- One `→` arrow per task, on its own line under the checkbox.
- Path is repo-relative from `apps/parakeet/src/` for modules, or the package
  root for engine/dashboard code (prefix with `packages/training-engine/src/`
  or `apps/dashboard/src/`).
- `:symbol` optional for whole-file tasks (tests, migrations).
- Multiple files on one task = multiple `→` lines; don't comma-separate.

Uncompleted tasks (`- [ ]`) should NOT have arrows — add them at completion.

## Backward link: code → spec

Every non-trivial module file SHOULD start with a `@spec` comment.

```ts
// @spec docs/features/jit/spec-pipeline.md
import { ... } from '...';
```

Rules:

- Single line, first non-shebang line of the file.
- Path repo-relative from repo root.
- Multiple specs allowed: one `@spec` line each.
- Skip for: barrels (`index.ts`), pure type files, trivial utils, generated
  code (`supabase/types.ts`).

## What counts as "non-trivial"

Link required:

- `application/*` orchestrators
- `data/*.queries.ts`, `data/*.repo.ts`, `data/*.codec.ts`
- `hooks/use*.ts` (if the hook encodes domain logic, not just a wrapper)
- `utils/*.ts` with named pure functions used across the module
- `ui/*.tsx` components that own feature state
- Engine modules: any file under `packages/training-engine/src/` except
  `index.ts` and `types.ts`

Link optional:

- `ui/` components that are pure presentation
- `model/` type-only files
- Tests — linked from the spec task instead

## Verification

Run `node tools/scripts/check-spec-links.mjs` (or `npm run check:spec-links`)
to verify:

1. Every `→ path:symbol` in a spec points to a real file.
2. Every `@spec docs/features/...` points to a real spec.
3. (Advisory) Modules with no `@spec` header in any file.

The check is advisory until rollout is complete. Once the backlog item for
back-annotating all modules ships, `/verify` will fail on orphans.

## Example

Spec excerpt (`docs/features/jit/spec-pipeline.md`):

```markdown
## Tasks

**`modules/jit/application/jit-session-generator.ts`:**

- [x] `runJIT(input): JITOutput` — 5-step pipeline
  → `modules/jit/application/jit-session-generator.ts:runJIT`
- [x] `buildAuxiliaryWork(...)` — volume top-up
  → `modules/jit/application/jit-session-generator.ts:buildAuxiliaryWork`
```

Code header (`modules/jit/application/jit-session-generator.ts`):

```ts
// @spec docs/features/jit/spec-pipeline.md
import { ... } from '@parakeet/training-engine';

export function runJIT(input: JITInput): JITOutput { ... }
```

Now grep `@spec docs/features/jit/spec-pipeline.md` finds every implementing
file, and grep `jit-session-generator.ts` in specs finds every task that owns
it.
