# Spec: Prescription Trace

**Status**: Implemented

**Domain**: Training Engine

## What This Covers

Adds a `PrescriptionTrace` type and inline trace builder to the JIT formula pipeline. Every weight, rep, set count, exercise selection, and rest duration decision is recorded with its derivation chain. The trace is an optional companion to `JITOutput` — existing callers are unaffected.

## Tasks

**`packages/training-engine/src/generator/prescription-trace.ts`:**

- [x] `WeightDerivation` type — oneRmKg, blockPct, baseWeightKg, modifiers (source + multiplier + reason), finalWeightKg
- [x] `SetTrace` type — setNumber, weightDerivation, reps, rpeTarget, repSource
- [x] `VolumeTrace` type — source, baseSets, resultSets, reason
- [x] `AuxExerciseTrace` type — exercise, selectionReason, weightDerivation (oneRmKg, catalogPct, isUnstable, finalWeightKg), repSource, sets, skipped, skipReason
- [x] `WarmupTrace` type — workingWeightKg, protocolName, steps (pct, rawWeight, clampedWeight, reps)
- [x] `RestTrace` type — mainLift (formulaBase, userOverride, llmDelta, final), auxiliary
- [x] `PrescriptionTrace` type — top-level container with sessionId, strategy, rationale, warnings, mainLift, auxiliaries, warmup, rest
- [x] `PrescriptionTraceBuilder` class — accumulator with methods: `recordModifier`, `recordVolumeChange`, `recordAuxSelection`, `recordWarmup`, `recordRest`, `build()`

**`packages/training-engine/src/generator/jit-session-generator.ts`:**

- [x] Add optional `traceBuilder?: PrescriptionTraceBuilder` parameter to `generateJITSession`
- [x] Hook trace builder at each pipeline step (Steps 1-6b)
- [x] Export `generateJITSessionWithTrace(input: JITInput)` wrapper returning `{ output: JITOutput; trace: PrescriptionTrace }`

**`packages/training-engine/src/index.ts`:**

- [x] Export `PrescriptionTrace`, `generateJITSessionWithTrace` types

**`packages/training-engine/src/generator/prescription-trace.test.ts`:**

- [x] Base case: standard input produces trace with all sections populated
- [x] Weight derivation: modifiers recorded for each active adjuster (soreness, readiness, cycle phase)
- [x] Volume trace: soreness-reduced sets shows baseSets > resultSets with reason
- [x] Aux exercise trace: pool rotation shows slot position; locked shows "Locked"; top-up shows MEV deficit
- [x] Recovery mode: trace shows recovery-specific derivation
- [x] Skipped main lift: trace shows skip reason
- [x] No modifiers active: trace shows clean derivation (no modifiers array entries)

## Dependencies

- [engine-007-jit-session-generator.md](./engine-007-jit-session-generator.md) — core pipeline being instrumented
