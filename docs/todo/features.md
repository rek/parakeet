# Features

This contains a list of new features to implement. An AI agent should work through this list and complete them.

Always consider the docs/designs first, to find where each feature request fits into the overall architecture of the app.

Always start by understanding basic docs overview: `docs/README.md`
Then ALWAYS read about the bug in question, first find the relevant design doc, then read it's specs, locations for them are:

- `docs/design/*.md`
- `docs/specs/**/*.md`

At the end remember to update design and specs at end with work actually done. then review this whole process and factor in any learnings into generic docs when done too so we optimize for next time. This is also referring to the AI Agent process and which prompts/scripts (readme files) we have with instructions.

## 1

bar weight needs to be settable from settings page
need to be careful to then factor this into every calculation everywhere it is to be found, since the whole app currently uses a hardcoded 20kg bar

## 2

when i click done on a set, then it should have a little floating box guy below the rest timer that asks for RPE. keep the existing rpe input box inline too, just incase i want to modify after the fact

## 4

i want freedom to just do any aux thing at anytime in my workout and log it. currently i have to only do what is prescribed. but in reality, humans are fickle and sometimes we just have the urge to do a set of somthing else
