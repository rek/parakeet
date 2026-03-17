Run all project validation checks and report pass/fail for each:

1. `tsc --noEmit -p apps/parakeet/tsconfig.typecheck.json`
2. `npm run check:module-boundary`
3. `npx nx affected -t test`

If dashboard files were changed in this session, also run:

4. `npx tsc --noEmit -p apps/dashboard/tsconfig.app.json`
5. `npx nx lint dashboard`

Report a summary table at the end with pass/fail status for each step.
