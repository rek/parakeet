# Spec: Nx Monorepo Setup

**Status**: Implemented
**Domain**: Infrastructure

## What This Covers

Initialize the Nx workspace and configure all apps and packages. This is the foundation all other specs depend on.

## Tasks

- [x] Create Nx workspace with `create-nx-workspace` (TypeScript preset)
- [x] Add `apps/parakeet` using `@nx/expo` generator (Expo SDK 54)
- [x] Add `apps/api` using `@nx/node` generator (Fastify target)
- [x] Add `packages/training-engine` using `@nx/js` generator
- [x] Add `packages/api-client` using `@nx/js` generator
- [x] Add `packages/shared-types` using `@nx/js` generator
- [x] Add `packages/db` using `@nx/js` generator
- [x] Configure `tsconfig.base.json` path aliases for all packages (`@parakeet/*`)
- [x] Configure Nx module boundary lint rules (parakeet cannot import engine, API cannot import parakeet)
- [x] Set up `.eslintrc.base.json` shared ESLint config
- [x] Set up `.prettierrc` shared formatting config
- [x] Configure `nx.json` with task caching and input/output rules for all targets
- [x] Add root `package.json` with workspace-level dev scripts
- [x] Verify `nx affected --target=test` works correctly on a clean clone

## Dependencies

None — this is the first spec to implement.

## References

- ADR: [001-monorepo-nx.md](../decisions/001-monorepo-nx.md)
