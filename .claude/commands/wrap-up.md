Complete the wrap-up phase for the current work. Follow `docs/guide/ai-workflow.md` phase 5.

## Checklist

1. **Design doc** — if one exists for this work, update its status to **Implemented** and add spec file links
2. **Specs — flip checkboxes for items that landed.**
   - For brand-new specs: update checkboxes to match what was actually built (not what was originally planned).
   - For **review-pass follow-ups** (sections titled `## Open Issues (YYYY-MM review)` or `## Known issues (YYYY-MM review)` added during a `/review` pass): every `- [ ]` item whose fix landed in a commit on this branch should become `- [x] (landed)` with the rest of the bullet text intact. Genuine unfinished items stay `- [ ]`.
   - Mechanical sweep: `grep -rln "Open Issues ([0-9]\{4\}-[0-9]\{2\} review)\|Known issues ([0-9]\{4\}-[0-9]\{2\} review)" docs/features/` to enumerate candidate specs. Cross-reference each `[ ]` against `git log --oneline <merge-base>..HEAD` commit subjects + bodies to decide whether to flip.
3. **Feature index** — update the feature's `docs/features/<feature>/index.md` frontmatter status and spec table
4. **DB types** — if migrations were added, verify `supabase/types.ts` is in sync. Run `npm run db:types` once the migration is applied locally. If app code shipped with `TODO(migration-cleanup)` casts (see [guide/migration-pattern.md](../../docs/guide/migration-pattern.md)), this is also when you drop them: `grep -rn "TODO(migration-cleanup)" apps/ packages/` after the regen and remove each cast site, then re-run typecheck.
5. **Learnings** — review `docs/guide/ai-learnings.md` for any new patterns worth capturing
6. **GitHub issues** — close associated issues with `gh issue close N`
7. **Backlog** — update `docs/backlog.md` (mark done with date, or remove)
