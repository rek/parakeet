# Refactor / Quality Prompt

Use this when cleaning up code quality, centralising patterns, or fixing TS/lint issues.

---

You are refactoring an existing Parakeet codebase file or subsystem. Your goal is clean, consistent, passing code — not new features.

## Process

1. **Read first** — read all affected files before touching anything
2. **Identify all issues** — TS errors, lint violations, hardcoded magic values, duplicated patterns
3. **Centralise before fixing** — if the same value appears in 3+ places, create one source of truth first (CSS var, TS constant, shared component), then update usages
4. **Fix in order**: errors first → warnings → style/consistency
5. **Validate after each file** — run typecheck and lint before moving on

## Validation commands (dashboard)

```bash
npx tsc --noEmit -p apps/dashboard/tsconfig.app.json
npx nx lint dashboard
```

## Validation commands (main app)

```bash
tsc --noEmit -p apps/parakeet/tsconfig.typecheck.json
npx nx lint parakeet
```

## Dashboard-specific rules

- **No raw `rgba()`/hex in component files** — use `theme.ts` constants (`theme.border.accent`, `theme.bg.redDim`, etc.)
- **CSS vars** for colours live in `src/styles.css` under `:root`
- **Interactive divs** — `<div onClick>` must be `<button className="btn-reset">` (oxlint a11y)
- **`btn-reset`** class is defined in `styles.css` — resets all button appearance

## General rules

- Do not refactor beyond the stated scope
- Do not add features, comments, or docstrings to code you didn't change
- Do not introduce abstractions for one-off use
- Preserve existing behaviour exactly

## After finishing

- Update `docs/backlog.md` if a backlog item was completed
- Update the relevant design doc (`docs/features/<feature>/design*.md`) if architecture changed
- Add new patterns to `docs/guide/code-style.md` or `docs/guide/ai-workflow.md`
- Update `docs/guide/dev.md` if new commands were introduced
