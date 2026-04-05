Read GitHub issue $ARGUMENTS using `gh issue view $ARGUMENTS`.

## Process

1. Read the issue fully. Identify: is this a bug fix or a feature?
2. Read `docs/README.md` to find relevant modules and their paths
3. Browse `docs/features/` for related feature dirs and check their `index.md` for current state
4. Check `docs/backlog.md` for related items
5. If **bug**: trace the code path, identify root cause, fix, add regression test
6. If **feature**: follow `docs/guide/ai-workflow.md` (Orient > Design > Plan > Implement > Validate > Wrap Up)
7. Read `docs/guide/code-style.md` before writing code
8. Read `docs/guide/project-organization.md` before adding files or modules

## Validate

Run `/verify` before committing.

## Finish

1. Commit referencing the issue (`Fixes #N` or `Closes #N`)
2. Create PR with `gh pr create` linking the issue
3. Run `/wrap-up` to update docs
