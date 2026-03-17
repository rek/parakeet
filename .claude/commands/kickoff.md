Start a new feature: $ARGUMENTS

## Process

1. Read `docs/README.md` to find relevant modules
2. Read `docs/specs/implementation-status.md` for current state and to avoid spec number conflicts
3. Check `docs/backlog.md` for existing entries related to this feature
4. Read `docs/guide/ai-workflow.md` for the full workflow

## Create docs

5. Create `docs/design/<feature-name>.md` using `docs/design/_TEMPLATE.md` — focus on WHAT and WHY, no code
6. Create spec(s) in the appropriate `docs/specs/<layer>/` folder using `docs/specs/_TEMPLATE.md` — focus on HOW, with file paths and checkboxes

## Review

7. Present the design doc for review before implementing
8. After approval, follow the Implement > Validate > Wrap Up phases from `docs/guide/ai-workflow.md`
