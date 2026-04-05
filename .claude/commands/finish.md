Complete the finishing phase for the current work. This combines review, docs alignment, and learning capture.

## Steps

### 1. Code Review

Use the `arch-code-reviewer` agent to review all changes made in this conversation. The review should check:

- Correctness of the implementation
- Architectural alignment (module boundaries, dependency rules)
- Completeness — are there remaining references to old values, stale comments, missed call sites?
- Test coverage — are the tests sufficient? Any gaps?
- Any runtime bugs the changes introduce

### 2. Fix Issues Found

Address all blocking issues found by the review. Non-blocking issues should be noted but don't need immediate fixes.

### 3. Documentation Alignment

Use an `Explore` agent to search the entire codebase for any documentation, specs, design docs, domain docs, code comments, and constants that are now out of alignment with the code changes. Key places to check:

- `docs/domain/` — domain source of truth
- `docs/features/` — feature specs and design docs
- `docs/guide/ai-learnings.md` — AI learnings
- Code comments across all changed and related files
- Related packages (training-sim, shared-types, etc.)

Update all stale references to match the current implementation.

### 4. Validation

Run `/verify` to confirm everything passes.

### 5. Key Learnings

Think about what went wrong and what patterns emerged. Consider:

- What was the root cause?
- What made it hard to catch?
- What pattern would have prevented this?
- Is there a generalizable lesson for `docs/guide/ai-learnings.md`?

If a new learning is worth capturing:

1. Update `docs/guide/ai-learnings.md` with the pattern
2. Save a memory if the learning applies across future conversations

### 6. Wrap-up (from ai-workflow phase 5)

- Update spec checkboxes in `docs/features/<feature>/spec-*.md` to match what was actually built
- Update the feature's `docs/features/<feature>/index.md` status and spec table
- Update `docs/backlog.md` if items were completed
