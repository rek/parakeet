# Bugs

This contains a list of currently active bugs. An AI agent should work through this list and resolve them.

When resolved, remove it from here, and update any relevant design/spec docs with changes.

When possible, solve in red/green TDD style.

Always start by understanding basic docs overview: `docs/README.md`
Then ALWAYS read about the bug in question, first find the relevant design doc, then read it's specs, locations for them are:

- `docs/design/*.md`
- `docs/specs/**/*.md`

At the end remember to update design and specs at end with work actually done. then review this whole process and factor in any learnings into generic docs when done too so we optimize for next time. This is also referring to the AI Agent process and which prompts/scripts (readme files) we have with instructions.

## 1

generate review program page
its a bit weird, something seems broken on it
explain how it should work
why two buttons after pressing review?
(check now, which flashes, and generate now)
(also it never seems to generate a program review...)

## 2

Cycle review schema validation error (Sentry ID: 101424655)
`AI_APICallError: Invalid schema for response_format 'response': In context=('properties', 'auxiliaryInsights', 'properties', 'recommendedChanges'), 'required' is required to be supplied and to be an array including every key in properties. Missing 'add'.`
400 Bad Request from OpenAI API during cycle review generation. The `CycleReviewSchema` Zod schema for `auxiliaryInsights.recommendedChanges` is missing `'add'` in its `required` array. Fix in `packages/shared-types/src/cycle-review.schema.ts`.

