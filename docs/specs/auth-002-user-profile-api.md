# Spec: User Profile API

**Status**: Planned
**Domain**: Auth & Users

## What This Covers

REST endpoints for creating and managing user profiles. Called immediately after Firebase sign-in on first login.

## Tasks

**Repository (`apps/api/src/modules/users/users.repository.ts`):**
- `findByFirebaseUid(firebaseUid: string): Promise<User | null>`
- `create(data: CreateUserData): Promise<User>`
- `update(userId: string, data: UpdateUserData): Promise<User>`
- `softDelete(userId: string): Promise<void>` — sets `deleted_at`, does not remove row

**Service (`apps/api/src/modules/users/users.service.ts`):**
- `getOrCreateUser(firebaseUid: string, email: string): Promise<User>` — called by auth plugin on first request; idempotent
- `updateProfile(userId: string, data: UpdateProfileData): Promise<User>`
- `deleteAccount(userId: string): Promise<void>` — soft delete + revoke Firebase token

**Routes (`apps/api/src/modules/users/users.routes.ts`):**
- `POST /v1/users/me` — Create user (called on first login; idempotent via `getOrCreateUser`)
- `GET /v1/users/me` — Return user profile (id, email, display_name, created_at)
- `PATCH /v1/users/me` — Update display_name, unit_preference (lbs/kg)
- `DELETE /v1/users/me` — Soft delete account

**Validation:**
- All endpoints use Zod schemas from `packages/shared-types` for request/response
- `PATCH` only allows `display_name` and `unit_preference` fields (no email override)

## Dependencies

- [auth-001-firebase-auth-setup.md](./auth-001-firebase-auth-setup.md)
- [infra-005-database-migrations.md](./infra-005-database-migrations.md)
- [types-001-zod-schemas.md](./types-001-zod-schemas.md)
