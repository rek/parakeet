# Spec: API Client Setup

**Status**: Planned
**Domain**: Mobile App

## What This Covers

The typed HTTP client in `packages/api-client` that all mobile screens use to communicate with the API. Handles authentication, error parsing, and type safety.

## Tasks

**`packages/api-client/src/client.ts` (base client):**
- `createApiClient(config: { baseUrl: string, getToken: () => Promise<string> }): ApiClient`
- Uses `fetch` (built-in, no extra dependency)
- Before each request: calls `getToken()` to get Firebase ID token, sets `Authorization: Bearer`
- Content-Type: `application/json` for all requests with body
- Response parsing: if `!response.ok`, parse error body and throw typed `ApiError`
- `ApiError` shape: `{ code: string, message: string, status: number, details?: unknown }`

**Domain-specific client files:**
- `packages/api-client/src/programs.client.ts`
  - `submitLifterMaxes(input: LifterMaxesInput): Promise<LifterMaxesResponse>`
  - `getActiveProgram(): Promise<Program>`
  - `createProgram(input: CreateProgramInput): Promise<Program>`
  - `regenerateProgram(programId: string, input: RegenInput): Promise<Program>`

- `packages/api-client/src/sessions.client.ts`
  - `getTodaySession(): Promise<Session | null>`
  - `getSession(sessionId: string): Promise<Session>`
  - `startSession(sessionId: string): Promise<Session>`
  - `completeSession(sessionId: string, input: CompleteSessionInput): Promise<SessionLog>`
  - `skipSession(sessionId: string, reason?: string): Promise<Session>`

- `packages/api-client/src/edge-cases.client.ts`
  - `reportEdgeCase(input: CreateEdgeCaseInput): Promise<EdgeCaseWithSuggestions>`
  - `applyAdjustment(caseId: string): Promise<EdgeCase>`
  - `resolveEdgeCase(caseId: string, resolvedAt?: string): Promise<EdgeCase>`

- `packages/api-client/src/formulas.client.ts`
  - `getDefaults(): Promise<FormulaConfig>`
  - `getActiveConfig(): Promise<MergedFormulaConfig>`
  - `createOverride(input: CreateFormulaConfigInput): Promise<FormulaConfig>`
  - `getHistory(): Promise<FormulaConfig[]>`

**Mobile usage (`apps/mobile/services/api.ts`):**
```typescript
import { createApiClient } from '@parakeet/api-client'
import { getToken } from './auth'

export const api = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL,
  getToken,
})
```

**Environment configuration (`apps/mobile/app.config.ts`):**
- `EXPO_PUBLIC_API_URL`: `https://api.parakeet.app/v1` (prod), `https://api-dev.parakeet.app/v1` (dev)
- Set via EAS environment variable groups per build profile

## Dependencies

- [types-001-zod-schemas.md](./types-001-zod-schemas.md)
- [mobile-002-auth-flow.md](./mobile-002-auth-flow.md)
