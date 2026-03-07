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

## 2 DONE

clicking on bench in history is crashing at the moment:

ERROR [InvalidInputError: Invalid inputs: weightKg=40, reps=50. weightKg must be > 0, reps must be between 1 and 20.]

Code: errors.ts
1 | export class InvalidInputError extends Error {
2 | constructor(message: string) {

> 3 | super(message)

    |     ^

4 | this.name = 'InvalidInputError'
5 | }
6 | }
Call Stack
InvalidInputError#constructor (packages/training-engine/src/errors.ts:3:5)
validateInputs (packages/training-engine/src/formulas/one-rep-max.ts:5:32)
estimateOneRepMax_Epley (packages/training-engine/src/formulas/one-rep-max.ts:12:17)
estimateBestOneRm (apps/parakeet/src/app/history/lift/[lift].tsx:67:65)
