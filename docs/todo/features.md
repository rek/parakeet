# Features

This contains a list of new features to implement. An AI agent should work through this list and complete them.

Always consider the docs/designs first, to find where each feature request fits into the overall architecture of the app.

Always start by understanding basic docs overview: `docs/README.md`
Then ALWAYS read about the feature in question, first find the relevant design doc, then read its specs:

- `docs/design/*.md`
- `docs/specs/**/*.md`

At the end: update design doc status → Implemented, update specs to match what was actually built, update `IMPLEMENTATION_STATUS.md`, then review this whole process and add any learnings to `docs/AI_WORKFLOW.md`.

## 1

we should have muscle mappings per aux exercise.
this is to enable a feature which is:

- if our MRV is too low, we can auto add a workout, or extend a workout with aux that is targeted to those specific under stimulated muscles

so there is kinda of a three level mapping:
muscle group -> main exercise
aux exercise -> muscle group

this should allow us also then to add a 'general' group, so that we can put cardio or core things in there that we can randomally add in (different feature perhaps). or use in future programmes.

i guess another idea is to have more AUXILIARY_POOLS, as lots of those guys are not actually right for the main lifts. is this our only aux lift mapping page?(packages/training-engine/src/auxiliary/auxiliary-rotator.ts)

this is also because i want lots of possible aux, but i don't want them to be in the pool of forced regular ones for the main lifts

help me condense this rambling into some design doc changes/feature
