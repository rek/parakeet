# Spec: [Feature Name]

**Status**: Planned | In Progress | Implemented

**Domain**: Training Engine | UI | Data / User Config | Infra | Auth

## What This Covers

One paragraph describing what this spec covers and why.

## Tasks

NOTE: include less specific code (unless really important for details) and more written instructions.

When a task is completed, add a `→` line under the checkbox pointing to the
implementing file and symbol. See
[docs/guide/spec-linking.md](../../guide/spec-linking.md).

**`path/to/file.ts`:**

- [ ] `functionName(param: Type): ReturnType` — brief description
  - Sub-detail that elaborates (not a separate task — no checkbox)
- [ ] Unit tests in `__tests__/file.test.ts`:
  - `functionName(input)` → expected output
  - Edge case description

Example of a completed task (with back-link):

- [x] `otherFunction(): void` — does the thing
  → `modules/<feature>/utils/other-file.ts:otherFunction`
- [x] Unit tests
  → `modules/<feature>/utils/__tests__/other-file.test.ts`

**`path/to/another-file.ts`:**

- [ ] Another task

## Dependencies

- [other-spec.md](./other-spec.md) — reason
