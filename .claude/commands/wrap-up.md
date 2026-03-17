Complete the wrap-up phase for the current work. Follow `docs/guide/ai-workflow.md` phase 5.

## Checklist

1. **Design doc** — if one exists for this work, update its status to **Implemented** and add spec file links
2. **Specs** — update spec checkboxes to match what was actually built (not what was originally planned)
3. **Implementation status** — update `docs/specs/implementation-status.md` with new entries, corrected test counts, new migrations
4. **DB types** — if migrations were added, verify `supabase/types.ts` is in sync (run `npm run db:types` if local Supabase is running)
5. **Learnings** — review `docs/guide/ai-learnings.md` for any new patterns worth capturing
6. **GitHub issues** — close associated issues with `gh issue close N`
7. **Backlog** — update `docs/backlog.md` (mark done with date, or remove)
