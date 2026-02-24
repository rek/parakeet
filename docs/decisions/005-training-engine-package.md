# ADR-005: Training Engine as a Separate Nx Package

**Date**: 2026-02-22

**Status**: Accepted

## Context

The core domain logic of Parakeet — generating programs, calculating loading percentages, applying formula configs, detecting performance patterns, and suggesting adjustments — is complex, testable in isolation, and must be kept strictly separate from both the parakeet frontend and the API framework. We need to decide where this logic lives and how it is structured.

## Decision

Extract all training domain logic into **`packages/training-engine`**: a pure TypeScript Nx library with zero framework dependencies (no Fastify, no Expo, no React).

In Phase 1, `apps/api` imports it directly as an Nx package dependency:

```typescript
import { generateProgram } from "@parakeet/training-engine";
```

`apps/parakeet` has zero access to `packages/training-engine` (enforced via Nx module boundary rules).

## Rationale

### Pros

- All domain logic is unit-testable without standing up a server or database
- The engine is deterministic: same inputs always produce the same program, enabling snapshot testing
- Framework-free: can be wrapped in any HTTP server or run in a Cloud Run Job without logic changes
- Clear migration path: in Phase 2+, wrap with a Fastify server, deploy as a separate Cloud Run service, change one import in `programs.service.ts` to an HTTP call
- Nx module boundary lint rules enforce that parakeet never imports engine logic (prevents accidental logic leakage to client)
- Python or other language implementations can be substituted later (the interface is well-defined via `packages/shared-types`)

### Cons

- More complex initial project structure vs. putting all logic in `apps/api/src/`
- Developers must understand the package boundary and remember to add tests to `packages/training-engine/__tests__/` not `apps/api/`

## Alternatives Considered

### Alternative 1: Training logic in `apps/api/src/domain/`

- Keeps everything in one deployable
- **Why not chosen:** Harder to test in isolation, no clear boundary prevents gradual leakage of business logic into route handlers, makes extraction to a microservice later significantly harder

### Alternative 2: Training logic in `apps/parakeet` (frontend calculation)

- No API round-trip for program generation
- **Why not chosen:** Explicitly prohibited by architecture requirements. Training logic must not live in the frontend. Formulas must be auditable server-side and protected from client manipulation.

### Alternative 3: Separate git repository + published npm package

- Clean package boundary with versioning
- **Why not chosen:** Adds publish/install cycle friction during rapid development. Can be extracted to a separate repo in Phase 3+ when the team and interface are stable.

## Consequences

### Positive

- `packages/training-engine` has 100% test coverage as a hard requirement (it is the safety-critical component)
- New programming systems (e.g., 5/3/1, GZCLP) can be added as additional modules without touching API code
- The engine interface (`generateProgram`, `calculateSets`, `suggestAdjustments`) is the true API contract for the backend's most important capability
- Formula configs are validated and applied exclusively in the engine, never ad-hoc in route handlers

### Negative

- Must maintain the Nx project configuration for the package (minor overhead)
- Import cycle lint rules must be configured correctly or developers will bypass the boundary

### Neutral

- Phase 1 engine runs in the same Node.js process as the API — no network hop, no latency
- Phase 2+ extraction to a microservice is a deployment concern, not a code change

## Implementation Notes

**Nx module boundary configuration (`nx.json`):**

```json
{
  "tasksRunnerOptions": {},
  "targetDefaults": {},
  "generators": {},
  "namedInputs": {}
}
```

**ESLint boundary rule (`.eslintrc.base.json`):**

```json
{
  "rules": {
    "@nx/enforce-module-boundaries": [
      "error",
      {
        "depConstraints": [
          {
            "sourceTag": "scope:parakeet",
            "onlyDependOnLibsWithTags": ["scope:shared", "scope:client"]
          },
          {
            "sourceTag": "scope:api",
            "onlyDependOnLibsWithTags": [
              "scope:shared",
              "scope:server",
              "scope:engine"
            ]
          }
        ]
      }
    ]
  }
}
```

**Package public API (`packages/training-engine/src/index.ts`):**

```typescript
// Program generation
export { generateProgram } from "./generator/program-generator";
export { estimateOneRepMax } from "./formulas/one-rep-max";

// Adjustment suggestions
export { suggestProgramAdjustments } from "./adjustments/performance-adjuster";
export { suggestEdgeCaseAdjustment } from "./adjustments/edge-case-adjuster";

// Default formula config (used by GET /v1/formulas/defaults)
export { DEFAULT_FORMULA_CONFIG } from "./cube/blocks";

// Types
export type {
  GeneratedProgram,
  FormulaConfig,
  LiftMaxes,
  AdjustmentSuggestion,
} from "./types/program.types";
```

## References

- [Nx Module Boundaries](https://nx.dev/concepts/module-boundaries)
- [Nx Library Types](https://nx.dev/concepts/decisions/project-size)
