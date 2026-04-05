# Spec: Push Muscle Volume Coverage Boost

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

A targeted refinement to `buildVolumeTopUp()` in `jit-session-generator.ts` that bypasses MEV pro-rating for push muscles (chest, triceps, shoulders) when the day's primary lift contributes zero to those muscles. This prevents push volume from being systematically under-trigged in squat/deadlift-heavy blocks.

Depends on:
- **JIT volume augmentation** (engine-027) — `buildVolumeTopUp()` function

## Problem

The pro-rated MEV formula (`ceil(mev × sessionIndex / totalSessionsThisWeek)`) uses week progress to avoid over-aggressively adding top-up volume in early sessions. This works well for muscles the primary lift already stimulates (e.g. hamstrings during squat). But push muscles receive **no contribution** from squat or deadlift, so the pro-rating only delays and weakens the top-up without any upside.

Worst case: 2 non-bench sessions/week, 3-set cap each → max 6 push sets. If chest MEV=8, the gap is never closed.

## Fix

### Engine — `packages/training-engine/src/generator/jit-session-generator.ts`

Inside `buildVolumeTopUp()`, in the per-muscle loop before computing `deficit`:

**Before:**
```typescript
const effectiveMev =
  sessionIndex && totalSessionsThisWeek && totalSessionsThisWeek > 0
    ? Math.ceil((mev * sessionIndex) / totalSessionsThisWeek)
    : mev;
```

**After:**
```typescript
// Push muscles (chest, triceps, shoulders) that receive zero direct contribution
// from today's primary lift use the full MEV target rather than the pro-rated
// threshold. This front-loads push coverage on squat/deadlift days, preventing
// zero-volume weeks when no bench session occurs or bench is skipped.
const isPushMuscle =
  muscle === 'chest' || muscle === 'triceps' || muscle === 'shoulders';
const primaryLiftContrib = mainContrib.get(muscle) ?? 0;
const effectiveMev =
  isPushMuscle && primaryLiftContrib === 0
    ? mev
    : sessionIndex && totalSessionsThisWeek && totalSessionsThisWeek > 0
      ? Math.ceil((mev * sessionIndex) / totalSessionsThisWeek)
      : mev;
```

### Invariants

- **Squat/deadlift day**: push muscles have `primaryLiftContrib === 0` → `effectiveMev = mev` (full, no pro-rating)
- **Bench day**: bench contributes chest 1.0, triceps 0.4, shoulders 0.4 → `primaryLiftContrib > 0` for all three → normal pro-rating applies, no change in behavior
- **Non-push muscles**: `isPushMuscle === false` → normal pro-rating applies, unchanged

## Tests

4 new tests in `src/generator/jit-session-generator.test.ts` under `describe('generateJITSession — push muscle coverage boost (engine-031)')`:

- [x] Chest gets top-up on squat day session 1 of 3 — full MEV used, not pro-rated
- [x] Push muscle session 2 of 3: boost yields 3 sets instead of 1 (weeklyChest=5, MEV=8, no pro-rating → deficit=3)
- [x] Bench day: push muscles use normal pro-rating — no boost when bench contributes chest
- [x] Non-push muscle on squat day still uses pro-rated MEV (upper_back path unchanged)
