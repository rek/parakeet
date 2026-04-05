# Feature: Simulation CI Improvements

**Status**: Implemented

**Date**: 16 Mar 2026

## Overview

Improve the training simulation CI pipeline with three capabilities: threshold tracking to catch regressions between PRs, JSON artifact generation for trend analysis, and additional life scripts covering peaking, competition prep, and return-from-layoff scenarios.

## Problem Statement

**Pain points:**
- CI only reports pass/fail. A PR that adds 10 new warnings passes silently — there's no way to detect gradual quality drift.
- JSON output exists (`--json` flag) but CI doesn't save artifacts. There's no way to track violation trends across builds.
- Life scripts cover common scenarios but miss important training phases: peaking for competition, competition week itself, and returning to training after extended time off.

**Desired outcome:** CI warns when a PR increases violations, generates downloadable artifacts for analysis, and validates the engine against a broader range of real-world training patterns.

## User Experience

This feature targets developers (CI pipeline consumers):
- PRs that increase violation counts get a visible warning annotation
- JSON artifacts are downloadable from GitHub Actions for trend analysis
- New life scripts catch engine regressions in edge-case training phases

## What We Chose NOT To Do

- **No dashboard for sim results** — artifacts are raw JSON, analyzed ad-hoc. A visualization layer is future work.
- **No automatic baseline updates** — the baseline file is committed manually after reviewing changes. This prevents silent drift.
- **No PR comment bot** — GitHub Actions annotations are sufficient for now.

## References

- Existing: `packages/training-sim/` (11 scenarios, 9 invariant categories)
- CI: `.github/workflows/ci.yml`
