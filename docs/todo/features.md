# Features

This contains a list of new features to implement. An AI agent should work through this list and complete them.

Always consider the docs/designs first, to find where each feature request fits into the overall architecture of the app.

Always start by understanding basic docs overview: `docs/README.md`
Then ALWAYS read about the bug in question, first find the relevant design doc, then read it's specs, locations for them are:

- `docs/design/*.md`
- `docs/specs/**/*.md`

At the end remember to update design and specs at end with work actually done. then review this whole process and factor in any learnings into generic docs when done too so we optimize for next time. This is also referring to the AI Agent process and which prompts/scripts (readme files) we have with instructions.

## 1 ✓ DONE (mobile-031)

bar weight needs to be settable from settings page
need to be careful to then factor this into every calculation everywhere it is to be found, since the whole app currently uses a hardcoded 20kg bar

## 2

need a csv import feature

data structure:
Date,Group,Exercise,Reps,Weight,IsCompleted,IsAMRAP,Notes

example row:
2025-03-14,Group 1,Barbell Deadlift,8,92.50,true,false,

you can scan the file i wanna import here: /home/adam/Downloads/NextSetWorkoutLog.csv

to find the unique exersises. how to sync them to our system?

## 5

export data... just in case
