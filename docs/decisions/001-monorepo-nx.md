# ADR-001: Nx Monorepo for Workspace Management

**Date**: 2026-02-22
**Status**: Accepted

## Context

We need to manage a multi-package codebase that includes a React Native parakeet app, a Node.js API, and several shared TypeScript packages (training engine, API client, shared types, database utilities). We need efficient build orchestration, code sharing without publishing to npm, and tooling that supports incremental CI/CD.

## Decision

Use **Nx** as the monorepo build system and workspace manager.

Key configuration:
- Nx workspace root with `nx.json` and `package.json` at root
- Apps in `apps/` (parakeet, api)
- Shared packages in `packages/` (training-engine, api-client, shared-types, db)
- TypeScript path aliases in `tsconfig.base.json` for cross-package imports
- Nx affected commands for CI to only test/build what changed

## Rationale

### Pros
- Incremental builds and test caching — only affected packages re-run in CI
- `nx affected` command detects which apps/packages changed and limits CI scope
- TypeScript path aliases enable clean cross-package imports without publishing to npm
- Strong support for Expo/React Native and Node.js targets
- Plugin ecosystem for common tasks (ESLint, Jest/Vitest, TypeScript)
- First-class dependency graph visualization for architecture review

### Cons
- Initial setup overhead vs. a simple single-package repo
- Nx cache can be confusing when debugging stale outputs
- Team must understand Nx project configuration (`project.json`) structure

## Alternatives Considered

### Alternative 1: Turborepo
- Similar capability to Nx for build caching and affected detection
- **Why not chosen:** Nx has stronger plugin ecosystem, better Expo support, and more mature TypeScript path alias handling

### Alternative 2: Separate repositories + npm packages
- Each package published to a private npm registry
- **Why not chosen:** Adds friction to cross-package development (publish → update → install cycle), slows iteration on shared types and training engine

### Alternative 3: Single flat package (no monorepo)
- Everything in one `package.json`
- **Why not chosen:** Would force training engine logic into the same deployable as the parakeet app, violating the architectural constraint that training logic must not live in the frontend

## Consequences

### Positive
- `packages/training-engine` can be imported directly by `apps/api` without npm publishing
- `packages/shared-types` ensures parakeet and API share the same Zod schemas and TypeScript types
- CI only runs tests for changed packages, keeping build times low as the project grows
- Clear physical separation enforces the architectural boundary: parakeet cannot accidentally import from training-engine

### Negative
- Developers must learn Nx concepts (targets, executors, affected)
- `node_modules` hoisting behavior can occasionally surprise; use `nx reset` when builds are stale

### Neutral
- All tooling config (ESLint, Prettier, TypeScript) is centralized at the workspace root

## Implementation Notes

```bash
# Create workspace
npx create-nx-workspace@latest parakeet --preset=ts

# Add Expo parakeet app
nx g @nx/expo:app parakeet

# Add Node API app
nx g @nx/node:app api

# Add packages
nx g @nx/js:lib training-engine --directory=packages/training-engine
nx g @nx/js:lib api-client     --directory=packages/api-client
nx g @nx/js:lib shared-types   --directory=packages/shared-types
nx g @nx/js:lib db             --directory=packages/db

# Run affected tests in CI
nx affected --target=test --base=origin/main
```

**Path alias example (`tsconfig.base.json`):**
```json
{
  "compilerOptions": {
    "paths": {
      "@parakeet/training-engine": ["packages/training-engine/src/index.ts"],
      "@parakeet/shared-types":    ["packages/shared-types/src/index.ts"],
      "@parakeet/api-client":      ["packages/api-client/src/index.ts"],
      "@parakeet/db":              ["packages/db/src/index.ts"]
    }
  }
}
```

## References

- [Nx Documentation](https://nx.dev)
- [Nx with Expo](https://nx.dev/nx-api/expo)
- [Nx with Node](https://nx.dev/nx-api/node)
