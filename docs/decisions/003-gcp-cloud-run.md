# ADR-003: GCP Cloud Run for API Deployment

**Date**: 2026-02-22
**Status**: Accepted

## Context

We need a backend compute platform on GCP that can host our Node.js Fastify API and a Pub/Sub analytics worker. The platform must support our Phase 1 requirements (low traffic, fast iteration) while being capable of scaling for future phases without re-platforming. Cost efficiency at low scale is critical for early-stage development.

## Decision

Use **GCP Cloud Run** (fully managed) for all backend compute.

- `training-api`: Fastify REST API service
- `analytics-worker`: Pub/Sub push subscriber for async event processing
- Future: `training-engine` as a separate service when extracted from the API monolith

## Rationale

### Pros
- Scale to zero in `dev` environment — zero cost when not in use
- No cluster management overhead vs. GKE
- Automatic HTTPS and TLS termination
- Native Pub/Sub push subscription support (HTTP endpoint)
- VPC connector for private Cloud SQL access
- Pay-per-request pricing is favorable at low traffic
- Container-based deployment integrates cleanly with GitHub Actions CI/CD
- Easy rollback via traffic splitting (`--to-revisions=PREVIOUS=100`)
- First-class support for Secret Manager secret injection

### Cons
- Cold start latency (mitigated by min 1 instance in production)
- Hard limit of 60-minute request timeout (acceptable for all current use cases)
- WebSocket support requires Cloud Run HTTP/2 (note for future real-time features)
- Not suitable for long-running background jobs (use Cloud Run Jobs instead)

## Alternatives Considered

### Alternative 1: GKE (Google Kubernetes Engine)
- Full Kubernetes cluster, maximum flexibility
- **Why not chosen:** Massive operational overhead for a small team. GKE autopilot is better but still requires Kubernetes expertise. Cloud Run provides 95% of the capability with 10% of the operational burden.

### Alternative 2: Google App Engine (Standard)
- Fully managed, similar to Cloud Run
- **Why not chosen:** Less flexible than Cloud Run for containerized workloads. Cloud Run is the modern successor; App Engine is in maintenance mode for new features.

### Alternative 3: GCE (Compute Engine) VMs
- Full control over the instance
- **Why not chosen:** Manual VM management, no auto-scaling, no scale-to-zero. Inappropriate for a fast-moving small team.

### Alternative 4: AWS (ECS Fargate or Lambda)
- Would avoid GCP vendor commitment
- **Why not chosen:** User requirement specifies GCP. Firebase Auth (already decided) integrates natively with GCP services.

## Consequences

### Positive
- Dev environment costs near zero (scale to zero)
- Production API stays responsive with min 1 instance
- Deployment is a single `gcloud run deploy` command (or CI/CD equivalent)
- Container-based: same Docker image runs locally and in production

### Negative
- All services must be containerized (Dockerfile required per app)
- Cloud Run service-to-service authentication requires IAM configuration
- Stateful workloads (e.g., WebSocket sessions) are not supported in standard Cloud Run

### Neutral
- The `training-engine` package runs in-process with `training-api` in Phase 1. No separate Cloud Run service needed until Phase 2+ scale warrants extraction.

## Implementation Notes

**Production configuration (training-api):**
```yaml
# cloud-run-config.yaml
service: training-api
region: us-central1
cpu: 1
memory: 512Mi
min-instances: 1
max-instances: 20
concurrency: 80
timeout: 30s
vpc-connector: parakeet-connector
vpc-egress: private-ranges-only
```

**Secret injection:**
```bash
gcloud run deploy training-api \
  --image gcr.io/parakeet-prod/training-api:$SHA \
  --set-secrets=DATABASE_URL=db-connection-string:latest \
  --set-secrets=FIREBASE_ADMIN_SDK=firebase-admin-sdk-json:latest
```

**Rollback:**
```bash
gcloud run services update-traffic training-api \
  --to-revisions=PREVIOUS=100 \
  --region=us-central1
```

## References

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Run VPC Connector](https://cloud.google.com/vpc/docs/configure-serverless-vpc-access)
- [Cloud Run with Secret Manager](https://cloud.google.com/run/docs/configuring/services/secrets)
