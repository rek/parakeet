# Spec: Simulation CI Improvements

**Status**: Implemented

**Domain**: Infra

## What This Covers

Three improvements to the training simulation CI pipeline: new life scripts for competition scenarios, JSON artifact generation, and threshold tracking to detect regressions.

## Tasks

### New Life Scripts

**`packages/training-sim/src/scripts/competition.ts`:**

- [x] `PEAKING_SCRIPT` — 12 weeks, peaking block weeks 9-11 (increasing soreness/fatigue), competition week 12 (Monday only)
- [x] `COMPETITION_PREP_SCRIPT` — 9 weeks, last heavy week 7, deload week 8, competition day week 9
- [x] `RETURN_FROM_LAYOFF_SCRIPT` — 12 weeks, 3-week complete layoff, gradual return weeks 4-6 with decreasing soreness, normal weeks 7-12

**`packages/training-sim/src/scripts/index.ts`:**

- [x] Re-export 3 new scripts

**`packages/training-sim/src/cli.ts`:**

- [x] Add 3 scenarios: Adam × peaking, Sarah × competition-prep, Injured Ivan × return-from-layoff

### JSON Artifact Generation

**`packages/training-sim/src/cli.ts`:**

- [x] `--output=<path>` flag writes JSON artifact to file via `writeFileSync`

**`.github/workflows/ci.yml`:**

- [x] Pass `--output=sim-results.json` to validate step
- [x] Upload artifact via `actions/upload-artifact@v4` (30-day retention)

### Threshold Tracking

**`packages/training-sim/src/threshold.ts`:**

- [x] `compareWithBaseline({ baselinePath, currentReports })` — reads baseline JSON, returns regressions (any metric that increased)
- [x] `generateBaseline({ reports })` — creates baseline JSON from current run

**`packages/training-sim/src/cli.ts`:**

- [x] After scenarios run, compare with `baseline.json`; print warnings for regressions
- [x] `--update-baseline` flag saves current results as new baseline

**`packages/training-sim/baseline.json`:**

- [x] Initial baseline committed (14 scenarios; 3 have 1 warning each)

## Dependencies

- None — extends existing simulation infrastructure
