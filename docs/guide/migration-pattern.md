# Migration Pattern

How to land an app-side change that depends on a Supabase schema change without breaking typecheck or splitting the work across PRs.

The case: you need to rename a column, add a column, or change a column's type. The app code that reads/writes the column has to ship at the same time. But the generated types in `supabase/types.ts` reflect the *current* schema, so any code referencing the new shape fails typecheck until the migration runs and `npm run db:types` regenerates.

## The pattern

Land in three phases inside the same series of commits:

### 1. Write the migration .sql but don't apply

Create `supabase/migrations/<YYYYMMDDHHMMSS>_<slug>.sql`. Wrap in `BEGIN/COMMIT`. Include a backfill step where the schema change implies one. Pre-flight checks (e.g. duplicate-detection queries) go in the migration comment, not as part of the migration itself — let a human run them before `db:push`.

**Example.** Converting `personal_records.weight_kg numeric` → `weight_grams int`:

```sql
BEGIN;

ALTER TABLE personal_records ADD COLUMN weight_grams integer;

UPDATE personal_records
SET weight_grams = ROUND(weight_kg * 1000)::integer
WHERE weight_kg IS NOT NULL;

DROP INDEX IF EXISTS pr_unique;
CREATE UNIQUE INDEX pr_unique
  ON personal_records (user_id, lift, pr_type, weight_grams)
  NULLS NOT DISTINCT;

ALTER TABLE personal_records DROP COLUMN weight_kg;

COMMIT;
```

### 2. Land app code that speaks the post-migration shape, bridged with casts

Write the app code as if the migration had already run. The generated types haven't been regenerated yet, so the supabase client will complain — bridge with **minimal, contained casts**:

- For `.upsert(rows)`: cast the rows array with `as never` if it's a single call site.
- For `.select('new_col')`: cast the column string with `as unknown as '*'` if `new_col` isn't yet in the generated types.
- For `Insert` payloads: cast the payload with `as Parameters<typeof insertFn>[0]` if a new optional column would otherwise fail strict checks.

Every cast must carry a **`TODO(migration-cleanup)`** token in a nearby comment, pointing at the migration file. Example:

```ts
// TODO(migration-cleanup): once 20260524000000_personal_records_grams.sql is
// applied and `npm run db:types` regenerates supabase/types.ts, drop the
// cast and let the generated row type flow through.
const { error } = await typedSupabase
  .from('personal_records')
  .upsert(rows as never, { onConflict: 'user_id,lift,pr_type,weight_grams' });
```

If the cast leaks into more than ~3 call sites, the bridge has outgrown the pattern — consider a narrow typed wrapper instead.

If you need a stopgap for `supabase/types.ts` itself (rare — usually the casts in app code are enough), prepend each manually-edited line with `// MANUAL: regenerate after <migration-filename>` so the next `db:types` run doesn't silently revert your bridge.

### 3. After the user applies the migration, regenerate types and drop the casts

In a small follow-up commit:

```bash
npm run db:types
```

Then `grep -rn "TODO(migration-cleanup)"` to find every bridge and remove it. Verify with `npx nx typecheck` — if anything fails, the bridge was hiding a real type mismatch and needs to be resolved before the cleanup commit lands.

## When NOT to use the pattern

- **Destructive migrations on shared production data** — don't bridge a column drop without your own confirmation pre-check. Run the duplicate-detection / cardinality query and inspect output before applying.
- **More than ~3 columns changing in one migration** — break it up. The casts compound and become hard to grep for cleanup.
- **Behavior changes coupled to the migration** — if the new schema implies a new business rule (e.g. a new `status` value), land the behavior change in a follow-up commit *after* the migration is applied, not as a bridged cast.

## Reference

Pattern was used in the 2026-05 review fixes:
- `20260524000000_personal_records_grams.sql` → `achievement.repository.ts` `as never` + `as unknown as '*'`
- `20260524000001_disruption_event_name.sql` → `disruptions/data/disruptions.repository.ts` `select('*')` bridge + `disruption.service.ts` `as Parameters<...>` cast on insert

Cleanup commit (`9f8c081`) dropped all four bridges in 25 lines of diff with zero behaviour change. Both regen and cleanup ran in under a minute end-to-end.
