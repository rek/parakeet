# Spec: Nx Monorepo Setup

**Status**: Planned
**Domain**: Infrastructure

## What This Covers

Initialize the Nx workspace and configure all apps and packages. This is the foundation all other specs depend on.

## Tasks

- Create Nx workspace with `create-nx-workspace` (TypeScript preset)
- Add `apps/mobile` using `@nx/expo` generator (Expo SDK 54)
- Add `apps/api` using `@nx/node` generator (Fastify target)
- Add `packages/training-engine` using `@nx/js` generator
- Add `packages/api-client` using `@nx/js` generator
- Add `packages/shared-types` using `@nx/js` generator
- Add `packages/db` using `@nx/js` generator
- Configure `tsconfig.base.json` path aliases for all packages (`@parakeet/*`)
- Configure Nx module boundary lint rules (mobile cannot import engine, API cannot import mobile)
- Set up `.eslintrc.base.json` shared ESLint config
- Set up `.prettierrc` shared formatting config
- Configure `nx.json` with task caching and input/output rules for all targets
- Add root `package.json` with workspace-level dev scripts
- Verify `nx affected --target=test` works correctly on a clean clone

## Dependencies

None — this is the first spec to implement.

## References

- ADR: [001-monorepo-nx.md](../decisions/001-monorepo-nx.md)
