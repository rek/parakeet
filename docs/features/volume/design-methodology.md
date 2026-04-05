# Volume & MRV Methodology

How this app counts training volume and applies it against MRV (Maximum Recoverable Volume). Reference this before changing any volume calculation logic.

## What Counts as a Working Set

Only **hard sets** count toward MRV — defined as sets taken within **0-3 reps of failure** (approximately RPE 7 or higher). This is the standard RP Strength / Mike Israetel definition.

| Set type | Counts toward MRV? | Reason |
|---|---|---|
| Main lift working sets | ✅ Yes | Hard sets, primary stimulus |
| Auxiliary exercise sets | ✅ Yes | Hard sets (JIT assigns RPE 7.5) |
| Warm-up sets | ❌ No | Far from failure, insufficient stimulus |
| Sets below ~60% 1RM | ❌ No | Not approaching failure for trained lifters |

**Source:** RP Strength Volume Landmarks framework; Arvo.guru volume guide ("Warm-up sets and sets stopped far from failure don't count toward your volume because they don't provide sufficient stimulus").

## Muscle Group Attribution

See [domain/muscle-mapping.md](../domain/muscle-mapping.md) for the canonical lift-to-muscle contribution tables (primary and secondary factors for Squat, Bench, and Deadlift).

### Auxiliary Exercises

Each exercise has its own muscle map (see `muscle-mapper.ts` `EXERCISE_MUSCLES`). This differs meaningfully from the parent lift — for example:
- **Close-Grip Bench** (bench day aux): triceps 1.0, chest 0.5, shoulders 0.5 (triceps is primary)
- **Overhead Press** (bench day aux): shoulders 1.0, triceps 1.0, upper_back 0.5 (chest barely involved)
- **Romanian DL** (deadlift day aux): hamstrings 1.0, glutes 1.0, lower_back 0.5

Using per-exercise mapping (not just parent lift fallback) is important for accuracy. A squat day with two quad-dominant accessories (e.g., Leg Press + Hack Squat) would otherwise look the same as one with glute-dominant work.

### No Double Counting

RP Strength explicitly warns against double counting. The volume landmark values (e.g., "quads MRV = 20 sets/week") already assume that compound lifts contribute indirectly to secondary muscles. We count each set once, with the contribution weight reflecting primary vs. secondary role.

## Volume Computation Pipeline

```
session_logs.actual_sets      → CompletedSetLog { lift, completedSets }
session_logs.auxiliary_sets   → CompletedSetLog { lift, completedSets, exercise }
                                           ↓
                             computeWeeklyVolume(logs, getMusclesForLift)
                                           ↓
                          Record<MuscleGroup, number>  (weekly set counts)
                                           ↓
                            classifyVolumeStatus(weekly, mrvMevConfig)
                                           ↓
                          Record<MuscleGroup, VolumeStatus>
```

`getMusclesForLift(lift, exercise?)` checks `EXERCISE_MUSCLES[exercise]` first; falls back to `LIFT_MUSCLES[lift]` for unknown exercises or main lift entries.

## Warm-up Sets (Future)

Warm-up sets are currently ephemeral UI state only (not persisted to DB). Even if we start persisting them (see `mobile-027-warmup-set-persistence.md`), they should NOT be added to the MRV volume pipeline — they don't qualify as hard sets.

They may still be worth storing for analytical purposes (session pacing review, readiness tracking) but that's a separate concern from MRV.

## Future: EMG-Based Contribution Refinement

The current contribution weights use a binary 1.0 / 0.5 model. More precise values (e.g. 0.75, 0.25) exist in the EMG literature and would improve accuracy for exercises with atypical secondary involvement — for example:
- **Leg Press**: minimal glutes (hip is not at full extension) — could be 0.25 instead of 0.5
- **Good Mornings**: very high lower_back demand — could warrant 1.0 + 1.0 instead of 1.0 + 0.5
- **Dips**: shoulder involvement varies by torso angle — chest-forward dips hit chest more than triceps

Key research sources to consult when refining:
- Bret Contreras EMG studies (via bretcontreras.com and published research)
- Brad Schoenfeld's *Science and Development of Muscle Hypertrophy*
- NSCA exercise science literature

Contribution values live in `EXERCISE_MUSCLES` in `packages/training-engine/src/volume/muscle-mapper.ts`.

## Domain References

- [domain/muscle-mapping.md](../domain/muscle-mapping.md) — canonical lift-to-muscle contribution weights (primary and secondary factors)
- [domain/volume-landmarks.md](../domain/volume-landmarks.md) — MEV/MRV defaults per muscle group

## Sources

- RP Strength: [Training Volume Landmarks for Muscle Growth](https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth)
- Arvo.guru: [Volume Training: MEV, MAV, MRV Explained](https://arvo.guru/resources/volume-training)
- Mike Israetel: [Maximum Recoverable Volume](https://propanefitness.com/maximum-recoverable-volume/) (Propane Fitness guest post)
- GymPsycho: [Volume Training: MEV, MAV, MRV](https://gympsycho.com/guides/volume-training.html)
