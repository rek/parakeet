# Diet Protocol Data

Authoring sources for the diet protocol catalog. Files here are the
**source of truth**; the database is a seeded mirror the app reads from.

## Files per protocol

| File | Purpose |
| --- | --- |
| `<slug>.csv` | Food allowlist. Columns: `category,food,status,notes`. |
| `<slug>.md` | Narrative prose. Seeded into `diet_protocols.description_md`. |
| `<slug>_supplements.csv` | Structured supplements. Optional per protocol. |
| `<slug>_lifestyle.csv` | Structured lifestyle components (compression, MLD, movement, sleep, stress). Optional. |

Currently: `keto.*` and `rad.*`. See [diets.md](./diets.md) for the index.

## Food CSV schema

```
category,food,status,notes
```

- `category` — snake_case. e.g. `proteins`, `dairy`, `vegetables`, `fruits`,
  `grains_and_bread`, `legumes`, `nuts_and_seeds`, `fats_and_oils`,
  `fermented_foods`, `condiments`, `drinks`, `morning_shot`, `treats`,
  `rad_superfoods` (rad only). **No `supplements` category** — supplements
  live in the structured CSV below.
- `food` — human-readable name. Duplicates across protocols are deduped by
  lowercased canonical form, so keep casing/spelling consistent.
- `status` — one of `yes`, `caution`, `no`.
  - `yes` — eat freely (within protocol rules).
  - `caution` — allowed but with a constraint; always explain in `notes`.
  - `no` — excluded.
- `notes` — free text. May contain commas. No quoting needed — parser treats
  everything after the third comma as notes.

## Supplement CSV schema

```
slug,name,tier,dose,rationale,evidence_grade,food_equivalent,nepal_sourcing,notes,sort_order
```

- `slug` — stable identifier (`vitamin_d3`, `selenium`, ...). Do not rename
  without migrating DB rows.
- `tier` — one of `core`, `food_sourced`, `optional`.
  - `core` — part of the recommended stack.
  - `food_sourced` — listed as a supplement but typically met via food.
  - `optional` — situational; take if indicated.
- `evidence_grade` — `A` (RCT/SR), `B` (retrospective/mechanistic),
  `C` (anecdotal/clinical experience).
- `nepal_sourcing` — `local`, `import`, `food`, or `mixed`.
- `sort_order` — integer for display order within a tier.
- Fields containing commas **must** be double-quoted (standards CSV).

See [supplements.md](./supplements.md) for the human rationale behind each
row.

## Lifestyle CSV schema

```
slug,name,category,frequency,description,rationale,sort_order
```

- `category` — one of `compression`, `manual_therapy`, `movement`, `sleep`,
  `stress`, `other`.
- `frequency` — `daily`, `weekly`, or `as_needed`.
- Quoting rules match the supplement CSV (double-quote fields containing
  commas).

## Status rules (foods)

- Every `caution` row **must** have notes explaining why/when.
- `no` rows may omit notes if the exclusion is self-evident for the protocol.
- If a food's status differs between protocols, that's expected — it's the
  whole point of the comparison.

## Research + refinement loop

1. **Seed** into local Supabase:
   ```bash
   # Daily research loop (CSV/MD edits, no schema change):
   npm run db:seed:diet

   # When a migration changes:
   npm run db:reset            # wipes + replays migrations
   npm run db:seed:diet        # reload CSVs + MDs
   npm run db:types            # regen supabase/types.ts
   nx typecheck parakeet       # verify types resolve
   ```
2. **Query** — run research SQL against the DB (see
   [research-queries.sql](./research-queries.sql)). Examples: cross-protocol
   diffs, category coverage, foods present in only one protocol.
3. **Edit the CSV or MD** when you find something to change: add a staple,
   reclassify `yes → caution`, split a vague row, update rationale prose.
4. **Re-seed** and re-query. Seed script is idempotent and prunes rows
   removed from the authoring source.
5. **Commit** with a message explaining *why* (e.g.
   `diet: move whey to caution on rad — IGF-1 concern, per <source>`).
   Git history is the refinement log.

## Never

- Don't edit rows directly in the database. Those edits will be overwritten
  on the next seed and leave no trace.
- Don't add a new food category without updating this README.
- Don't leave `caution` food rows without notes.
- Don't rename supplement `slug` values — they are stable identifiers.

## Adding a new protocol

1. Drop `<slug>.csv` (foods) and optionally `<slug>_supplements.csv`.
2. Write `<slug>.md` — narrative prose: goal, mechanism, rules,
   observable patterns, evidence quality, sources.
3. Add an entry to `PROTOCOLS` in
   `tools/scripts/seed-diet-protocols.ts`.
4. Update [diets.md](./diets.md) index.
5. Re-seed, run `research-queries.sql` #3 to check category coverage.

## Future

Once in-app editing lands, the DB becomes source of truth and an
export-to-CSV/MD script keeps the git backup. Not yet.
