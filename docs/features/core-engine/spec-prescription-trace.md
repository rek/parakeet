# Spec: Prescription Trace

**Status**: Implemented

**Domain**: Training Engine

## What This Covers

Adds a `PrescriptionTrace` type and inline trace builder to the JIT formula pipeline. Every weight, rep, set count, exercise selection, and rest duration decision is recorded with its derivation chain. The trace is an optional companion to `JITOutput` — existing callers are unaffected.

## Tasks

**`packages/training-engine/src/generator/prescription-trace.ts`:**

- [ ] `WeightDerivation` type — oneRmKg, blockPct, baseWeightKg, modifiers (source + multiplier + reason), finalWeightKg
- [ ] `SetTrace` type — setNumber, weightDerivation, reps, rpeTarget, repSource
- [ ] `VolumeTrace` type — source, baseSets, resultSets, reason
- [ ] `AuxExerciseTrace` type — exercise, selectionReason, weightDerivation (oneRmKg, catalogPct, isUnstable, finalWeightKg), repSource, sets, skipped, skipReason
- [ ] `WarmupTrace` type — workingWeightKg, protocolName, steps (pct, rawWeight, clampedWeight, reps)
- [ ] `RestTrace` type — mainLift (formulaBase, userOverride, llmDelta, final), auxiliary
- [ ] `PrescriptionTrace` type — top-level container with sessionId, strategy, rationale, warnings, mainLift, auxiliaries, warmup, rest
- [ ] `PrescriptionTraceBuilder` class — accumulator with methods: `recordModifier`, `recordVolumeChange`, `recordAuxSelection`, `recordWarmup`, `recordRest`, `build()`

**`packages/training-engine/src/generator/jit-session-generator.ts`:**

- [ ] Add optional `traceBuilder?: PrescriptionTraceBuilder` parameter to `generateJITSession`
- [ ] Hook trace builder at each pipeline step (Steps 1-6b)
- [ ] Export `generateJITSessionWithTrace(input: JITInput)` wrapper returning `{ output: JITOutput; trace: PrescriptionTrace }`

**`packages/training-engine/src/index.ts`:**

- [ ] Export `PrescriptionTrace`, `generateJITSessionWithTrace` types

**`packages/training-engine/src/generator/prescription-trace.test.ts`:**

- [ ] Base case: standard input produces trace with all sections populated
- [ ] Weight derivation: modifiers recorded for each active adjuster (soreness, readiness, cycle phase)
- [ ] Volume trace: soreness-reduced sets shows baseSets > resultSets with reason
- [ ] Aux exercise trace: pool rotation shows slot position; locked shows "Locked"; top-up shows MEV deficit
- [ ] Recovery mode: trace shows recovery-specific derivation
- [ ] Skipped main lift: trace shows skip reason
- [ ] No modifiers active: trace shows clean derivation (no modifiers array entries)

## Dependencies

- [engine-007-jit-session-generator.md](./engine-007-jit-session-generator.md) — core pipeline being instrumented
