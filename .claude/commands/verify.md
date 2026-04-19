Run all project validation checks and report pass/fail for each:

1. `npm run check:boundaries`
2. `npm run check:spec-links` (advisory — report orphans but do not fail on them during rollout)
3. `tsc --noEmit -p apps/parakeet/tsconfig.typecheck.json`
4. `npx nx affected -t test`
5. `npx nx lint parakeet`

If dashboard files were changed in this session, also run:

6. `npx tsc --noEmit -p apps/dashboard/tsconfig.app.json`
7. `npx nx lint dashboard`

Report a summary table at the end with pass/fail status for each step.
