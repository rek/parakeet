Start a new feature: $ARGUMENTS

## Process

1. Read `docs/README.md` to find relevant modules
2. Browse `docs/features/` to find related feature dirs and check their `index.md` for current state
3. Check `docs/backlog.md` for existing entries related to this feature
4. Read `docs/guide/ai-workflow.md` for the full workflow

## Create docs

5. Create `docs/features/<feature>/design.md` using `docs/features/_TEMPLATE/design.md` — focus on WHAT and WHY, no code
6. Create spec(s) in `docs/features/<feature>/spec-*.md` using `docs/features/_TEMPLATE/spec-TEMPLATE.md` — focus on HOW, with file paths and checkboxes
7. Create `docs/features/<feature>/index.md` with YAML frontmatter (feature, status, modules) and spec table

## Review

7. Present the design doc for review before implementing
8. After approval, follow the Implement > Validate > Wrap Up phases from `docs/guide/ai-workflow.md`
