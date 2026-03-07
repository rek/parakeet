# Features

This contains a list of new features to implement. An AI agent should work through this list and complete them.

Always consider the docs/designs first, to find where each feature request fits into the overall architecture of the app.

Always start by understanding basic docs overview: `docs/README.md`
Then ALWAYS read about the feature in question, first find the relevant design doc, then read its specs:

- `docs/design/*.md`
- `docs/specs/**/*.md`

At the end: update design doc status → Implemented, update specs to match what was actually built, update `IMPLEMENTATION_STATUS.md`, then review this whole process and add any learnings to `docs/AI_WORKFLOW.md`.

## 1 ✓ DONE (mobile-031)

bar weight needs to be settable from settings page
need to be careful to then factor this into every calculation everywhere it is to be found, since the whole app currently uses a hardcoded 20kg bar

## 2 ✓ DONE

need a csv import feature

data structure:
Date,Group,Exercise,Reps,Weight,IsCompleted,IsAMRAP,Notes

example row:
2025-03-14,Group 1,Barbell Deadlift,8,92.50,true,false,

you can scan the file i wanna import here: /home/adam/Downloads/NextSetWorkoutLog.csv

to find the unique exersises. how to sync them to our system?

→ Implemented as `scripts/import-csv.ts` (CLI, not mobile UI — one-time migration doesn't warrant screens).
Auto-detects NextSet + Strong formats. Interactive exercise mapping. Stores as program_id=null historical sessions.
See `docs/design/csv-import.md`. Migration: 20260314000000.

## 5

export data... just in case
