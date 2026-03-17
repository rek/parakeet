Pure domain logic — no React, no Supabase, no side effects.

## Key Rules

- All weights internally in **grams** (integer). Convert kg at boundaries.
- Entry point: `src/index.ts`. Check existing exports before adding new ones.
- `export *` for most modules; `program-generator` uses selective exports to avoid naming conflicts.
- JIT types (`JITInput`, `JITOutput`, `AuxiliaryWork`) are defined in `jit-session-generator.ts`, not `types.ts`.
- AI models: `JIT_MODEL` (gpt-4o-mini) exported from `src/ai/models.ts` — reuse this, don't create new model instances.

## Testing

```bash
npx nx test training-engine                          # All tests
npx nx test training-engine -- src/jit/              # Filter to directory
npx nx test training-engine -- --reporter=verbose    # See individual test names
```

- **Vitest** (not Jest). Never run `npx vitest` directly — path aliases only resolve through nx.
- Shared fixtures in `__test-helpers__/fixtures.ts`.
- Prefer invariant tests (combinatorial matrices) and scenario tests over point tests.
