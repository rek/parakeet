# Feature: Push Muscle Volume Coverage

**Status**: Implemented

**Date**: 12 Mar 2026

> **Design Doc Philosophy**: This document describes WHAT the feature does and WHY, from a user perspective. Technical implementation details (HOW) are tracked in specs for granular task management. Keep this doc user-focused, concise, and free of code/implementation specifics.

## Overview

When a training block is dominated by squat and deadlift sessions (no bench day, or bench is skipped), chest, triceps, and shoulders can go an entire week with zero direct volume. The existing volume top-up mechanism partially addresses this, but its pro-rated MEV threshold means push muscles often fall short on early-week sessions.

This fix ensures that push muscles without any contribution from the day's primary lift always measure deficit against the full weekly MEV, not the pro-rated fraction. The result: the top-up fires earlier and more aggressively for chest/triceps/shoulders on squat and deadlift days.

## Problem Statement

The volume top-up uses a pro-rated MEV threshold: on session 1 of 3, a muscle only needs to reach ~33% of MEV to avoid triggering a top-up. For muscles like hamstrings that the squat already stimulates, this is sensible — the squat contributes to that muscle's weekly total.

But squat and deadlift contribute **zero** to chest, triceps, and shoulders. In a week with 2 non-bench sessions and the 3-set top-up cap, push muscles can accumulate only 6 sets — below MEV=8 for chest — while the pro-rated threshold was too low to trigger the top-up in early sessions.

Result: users miss chest/tricep/shoulder volume in squat-heavy blocks with no corrective action until it's too late in the week.

## Solution

For push muscles (chest, triceps, shoulders) only: if today's primary lift contributes **zero** to that muscle, skip the pro-rating and compare against the full weekly MEV instead. This front-loads push coverage on squat/deadlift days.

On bench day, the bench press contributes chest 1.0 × main sets, so `primaryLiftContrib > 0` — the boost doesn't apply, and normal pro-rating continues.

The 3-set top-up cap still prevents overtraining. The change only affects the **threshold** that decides whether a top-up fires at all.

## User Experience

No visible change to the UI. Users on squat/deadlift-heavy weeks will see chest, triceps, or shoulder top-up exercises appear earlier in the week rather than only on the last session (or not at all).

## Dependencies

- **JIT volume augmentation** (engine-027) — this is a refinement of `buildVolumeTopUp()`

## References

- Spec: [engine-031-push-volume-boost.md](./spec-push-boost.md)
- Backlog: [docs/backlog.md](../backlog.md) — Item 12
- Engine: `packages/training-engine/src/generator/jit-session-generator.ts`
