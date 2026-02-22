# Spec: GCP Project Bootstrap

**Status**: Planned
**Domain**: Infrastructure

## What This Covers

Provision all GCP infrastructure for the `dev` environment. `staging` and `prod` environments follow the same steps with environment-specific values.

## Tasks

- Create GCP project `parakeet-dev`
- Enable required APIs: Cloud Run, Cloud SQL, Cloud Pub/Sub, Secret Manager, Artifact Registry, Cloud Build, VPC
- Create VPC `parakeet-vpc` with private subnet `10.10.0.0/24`
- Create Serverless VPC Access connector `parakeet-connector` in `us-central1`
- Provision Cloud SQL PostgreSQL 14 instance (private IP, no public IP)
  - Instance: `parakeet-db`, region `us-central1`, 2 vCPU, 8GB RAM (prod); 1 vCPU, 4GB RAM (dev)
  - Create database: `parakeet`
  - Create application user with least-privilege permissions
  - Enable PITR and automated daily backups (prod)
- Create Artifact Registry Docker repository `parakeet-images`
- Create Pub/Sub topics: `session-completed`, `edge-case-created`, `program-generated`
- Create Pub/Sub subscriptions for `analytics-worker` (push subscription, HTTP endpoint)
- Create Secret Manager secrets: `db-connection-string`, `firebase-admin-sdk-json`
- Create service accounts:
  - `training-api@` — roles: `cloudsql.client`, `pubsub.publisher`, `secretmanager.secretAccessor`
  - `analytics-worker@` — roles: `pubsub.subscriber`, `cloudsql.client`, `secretmanager.secretAccessor`
- Set up Firebase project `parakeet-dev` and enable Authentication (Google + Apple providers)
- Document all resource names and IDs in a non-committed local config file

## Dependencies

- [infra-001-nx-monorepo-setup.md](./infra-001-nx-monorepo-setup.md)

## References

- ADR: [003-gcp-cloud-run.md](../decisions/003-gcp-cloud-run.md)
- ADR: [004-postgresql-cloud-sql.md](../decisions/004-postgresql-cloud-sql.md)
