# CSV Import Design

**Status: Implemented** — `scripts/import-csv.ts`, migration `20260314000000`

## Problem Statement

Users coming from other tracking apps have years of historical lifting data they'd like to bring into Parakeet. Without a migration path, adoption requires starting from scratch — losing PR history, volume trends, and continuity.

Parakeet has two users. This is a one-time migration, not an ongoing feature. Building mobile screens for it would be engineering waste. A CLI script is the right tool: runs once locally, talks directly to Supabase, done.

## Approach: CLI Script

`scripts/import-csv.ts` — run via `npx tsx`. Uses the Supabase service role key (bypasses RLS) so it can insert on behalf of any user.

```
SUPABASE_URL=http://localhost:54321 \
SUPABASE_SERVICE_KEY=<secret key> \
npx tsx scripts/import-csv.ts \
  --file ~/exports/export.csv \
  --user-id <uuid> \
  [--unit kg|lbs] \
  [--dry-run]
```

Get the service key from `npx supabase status` (the "Secret" key).

### Execution Flow

1. **Parse** — auto-detect CSV format from header. Report row count, exercise list, date range.
2. **Map exercises** — interactive: print each unique exercise name, auto-suggest canonical lift key, user accepts or overrides. Type `skip` to exclude.
3. **Dry run summary** — sessions, sets, skipped count. Prompt `Import? [y/N]`.
4. **Insert** — session rows then session_log rows. No program row.
5. **Report** — inserted counts.

## Exercise Mapping Strategy

Keyword heuristics, no fuzzy library. Parenthetical qualifiers like `(Barbell)` stripped before matching. Matching is case-insensitive.

| Canonical key | Keywords that match |
|---|---|
| `squat` | squat, back squat, low bar, high bar |
| `bench` | bench, bench press, chest press |
| `deadlift` | deadlift, dead lift, conventional, sumo |
| `overhead_press` | overhead press, ohp, shoulder press, military press |

If no keyword matches, the exercise is shown with no suggestion and the user types a key or `skip`.

## CSV Format Support

Auto-detected from the header row. Two formats supported:

### NextSet (`Date,Group,Exercise,Reps,Weight,IsCompleted,IsAMRAP,Notes`)

The primary format — this is the actual data being imported.

```
Date,Group,Exercise,Reps,Weight,IsCompleted,IsAMRAP,Notes
2021-07-28,Juggernaut Press,Barbell Overhead Press,10,40.00,true,false,
```

- No set order column — derived from row sequence within each date+exercise group
- `IsCompleted=false` rows are skipped silently
- No time in date field — stored as noon UTC
- Weight is kg decimal

### Strong (`Date,Workout Name,Exercise Name,Set Order,Weight,Reps,RPE,Notes`)

Secondary format — supports Strong app exports.

```
Date,Workout Name,Exercise Name,Set Order,Weight,Reps,RPE,Notes
2024-01-15 09:30:00,Push Day,Bench Press (Barbell),1,100,5,,
```

- Date includes time
- Set order is explicit

Format is auto-detected: if header contains `iscompleted` or `group` → NextSet; if `exercise_name` or `set_order` → Strong.

## Data Model

### Sessions

Imported sessions have `program_id = null`. They are historical records, not part of any training program.

Per date+lift combination, one `sessions` row:

```
sessions
  program_id: null
  user_id: <target user>
  primary_lift: <mapped canonical key>
  intensity_type: 'import'   -- sentinel value; excluded from JIT/cycle logic
  day_number: 0              -- sentinel
  week_number: 0             -- sentinel
  status: 'completed'
  planned_date: <YYYY-MM-DD from CSV>
  completed_at: <noon UTC for that date>
  jit_generated_at: null
  planned_sets: null
```

If a date has sets for both `squat` and `bench`, two separate session rows are created.

### Session Logs

One `session_logs` row per session, with all sets bundled in `actual_sets`:

```
session_logs
  session_id: <parent session id>
  user_id: <target user>
  actual_sets: [{ set_number, weight_grams, reps_completed, rpe_actual? }, ...]
  auxiliary_sets: null
  session_rpe: null
  completion_pct: 100
  performance_vs_plan: 'at'
  completed_at: <noon UTC>
```

## What Gets Stored vs Skipped

**Stored:** all sets for mapped exercises where `IsCompleted=true`, weight > 0, reps > 0.

**Skipped:**
- Exercises mapped to `skip`
- `IsCompleted=false` rows (NextSet format)
- Sets with zero weight or zero reps
- Rows with unparseable dates

Skipped count printed at parse time and in dry-run summary.

## Schema Changes

Migration `20260314000000_nullable_program_id_for_imports.sql`:

```sql
ALTER TABLE sessions ALTER COLUMN program_id DROP NOT NULL;

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_intensity_type_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_intensity_type_check
  CHECK (intensity_type = ANY (ARRAY['heavy', 'explosive', 'rep', 'deload', 'import']));
```

`supabase/types.ts` hand-edited to reflect nullable `program_id` on sessions.

App code fixes from nullable cascade:
- `session.repository.ts`: `row.program_id!` in `fetchOverdueScheduledSessions` (inner join guarantees non-null)
- `jit/lib/jit.ts`: `session.program_id!` in two spots (JIT never runs on import sessions)

## Future Considerations

- **Duplicate detection** — check for existing sessions on the same date+lift before inserting; warn and skip rather than duplicating.
- **1RM backfill** — after import, optionally recalculate historical 1RMs from imported sets and update `lifter_maxes`.
- **Additional formats** — Hevy, Barbell Logic; auto-detection pattern already in place.
