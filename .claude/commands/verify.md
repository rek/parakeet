Run all project validation checks and report pass/fail for each:

1. `npm run check:boundaries`
2. `tsc --noEmit -p apps/parakeet/tsconfig.typecheck.json`
3. `npx nx affected -t test`
4. `npx nx lint parakeet`

If dashboard files were changed in this session, also run:

5. `npx tsc --noEmit -p apps/dashboard/tsconfig.app.json`
6. `npx nx lint dashboard`

Report a summary table at the end with pass/fail status for each step.
