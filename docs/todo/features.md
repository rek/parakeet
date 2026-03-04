# Features

Always consider the docs/designs first, to find where each feature request fits into the overall architecture of the app.

Read docs/README.md and other relevant docs to get a good picture of our system before starting to plan a feature.

## 1

in history, there is no way to actually go 'into' a workout
to see the actual lifts and things done
only the summary is there to see an overview

## 2

in history page, do we have a way to see previous programs? (completed, abandoned etc)

## 3

if you log a 'no equipment' disruption,
then the aux should increase and include some extra bodyweight stuff to compensate

## 4

can you cancel or abandon a workout once you have started it?
perhaps you clicked it by mistake and want to reset it back to un-done state to complete at another time

## 5

need to finish setting up supabase prod, so we can finish deployment of real app version for users

## 6

need to be able to make 'unending' programs, ones that are constantly dynamically generated JIT, so when in this mode, the next weeks workout will not be in the 'program' card, even this weeks whole plan will not be there.
only the next single workout. and once that is completed, then it will generate a plan for the next workout entirely based upon how your previous one (and other historical things) went

## 7

for unending programs, we need an option to 'finish' them, which perhaps is just the same as 'abandon' and we should rename that to 'end program'?
