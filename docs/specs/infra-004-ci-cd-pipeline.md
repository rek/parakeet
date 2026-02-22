# Spec: CI/CD Pipeline

**Status**: Planned
**Domain**: Infrastructure

## What This Covers

GitHub Actions workflows for continuous integration (every PR) and continuous deployment (every merge to main).

## Tasks

**CI workflow (`.github/workflows/ci.yml`):**
- Trigger: pull_request to main
- Steps:
  1. Checkout + setup Node.js (20.x) + restore Nx cache
  2. `npm ci` (install dependencies)
  3. `nx affected --target=typecheck --base=origin/main` — TypeScript type checking
  4. `nx affected --target=lint --base=origin/main` — ESLint
  5. `nx affected --target=test --base=origin/main` — Vitest unit tests
  6. Upload test results as artifact
- Fail fast on first error

**Deploy API workflow (`.github/workflows/deploy-api.yml`):**
- Trigger: push to main (when `apps/api/**` or `packages/**` changed)
- Steps:
  1. `nx affected --target=build --projects=api`
  2. Authenticate to GCP via Workload Identity Federation (no long-lived keys)
  3. Docker build and push to Artifact Registry
  4. Deploy to `staging` Cloud Run service
  5. Run smoke test: `POST /health` and `GET /v1/healthz`
  6. Deploy to `prod` Cloud Run service (gated on smoke test pass)
- On failure: Slack notification to `#deploys` channel (webhook secret in GitHub Secrets)

**Deploy Mobile workflow (`.github/workflows/eas-build.yml`):**
- Trigger: push to main (when `apps/mobile/**` changed)
- Determine change type:
  - JS-only changes (no native module changes): `eas update --branch production`
  - Native changes: `eas build --platform all --profile production`
- EAS token stored in GitHub Secrets

**Rollback runbook** (documented in workflow comments):
```bash
gcloud run services update-traffic training-api \
  --to-revisions=PREVIOUS=100 \
  --region=us-central1 \
  --project=parakeet-prod
```

## Dependencies

- [infra-003-cloud-run-api-service.md](./infra-003-cloud-run-api-service.md)
- [infra-002-gcp-project-bootstrap.md](./infra-002-gcp-project-bootstrap.md)
