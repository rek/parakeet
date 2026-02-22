# Spec: Cloud Run API Service Configuration

**Status**: Planned
**Domain**: Infrastructure

## What This Covers

Dockerfile and Cloud Run service configuration for `apps/api` (training-api) and `analytics-worker`.

## Tasks

**Dockerfile (`apps/api/Dockerfile`):**
- Multi-stage build: `builder` stage compiles TypeScript, `runner` stage is lean Node.js image
- Use `node:20-alpine` base image
- Copy only compiled output and `node_modules` (production only) to runner stage
- Set `NODE_ENV=production`, `PORT=8080`
- Expose port 8080
- Health check endpoint: `GET /health` returns 200

**Cloud Run service configuration (training-api):**
- Region: `us-central1`
- CPU: 1, Memory: 512Mi
- Min instances: 0 (dev), 1 (prod)
- Max instances: 5 (dev), 20 (prod)
- Request timeout: 30s
- Concurrency: 80 requests/instance
- VPC connector: `parakeet-connector`, egress: private ranges only
- Service account: `training-api@`
- Secret env vars: `DATABASE_URL` from `db-connection-string`, `FIREBASE_ADMIN_SDK_JSON` from `firebase-admin-sdk-json`
- Environment vars: `NODE_ENV`, `PUBSUB_PROJECT_ID`, `PORT=8080`

**Dockerfile (`apps/api/Dockerfile.worker`):**
- Same base pattern as training-api
- Entry point: analytics worker process (Pub/Sub push HTTP handler)

**Cloud Run service configuration (analytics-worker):**
- Same region and VPC connector
- Min instances: 0 (scales to zero when no messages)
- Max instances: 5
- Timeout: 60s (message processing may take longer)
- Service account: `analytics-worker@`

**Local development:**
- `docker-compose.yml` at workspace root for local API + Postgres
- Cloud SQL Auth Proxy included in compose for dev DB access
- Hot reload via `tsx watch` in development mode (not Docker)

## Dependencies

- [infra-002-gcp-project-bootstrap.md](./infra-002-gcp-project-bootstrap.md)

## References

- ADR: [003-gcp-cloud-run.md](../decisions/003-gcp-cloud-run.md)
