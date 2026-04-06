# social-002: QR Pairing Flow

**Status**: Done

**Design**: [gym-partner-filming.md](./design.md)

## What This Covers

QR code generation, QR scanning, invite claiming, approval/decline flow, and partner management screen. This is the user-facing pairing workflow built on the database foundation from social-001.

## Tasks

### QR payload encoding

**`apps/parakeet/src/modules/gym-partners/lib/qr-payload.ts`:**

- [x] `encodeQrPayload(token: string): string` — JSON.stringify `{ token, version: 1 }`
- [x] `decodeQrPayload(raw: string): { token: string } | null` — parse + validate, return null on invalid
- [x] Unit tests in `__tests__/qr-payload.test.ts`:
  - Round-trip encode/decode
  - Invalid JSON returns null
  - Missing token field returns null
  - Extra fields ignored (forward compatible)

### Pairing service

**`apps/parakeet/src/modules/gym-partners/application/pairing.service.ts`:**

- [x] `createInvite(): Promise<{ token: string; expiresAt: string }>` — calls `partner.repository.createInvite()`, returns token for QR display
  - Guard: reject if current user has no `display_name` set (Decision 17 — inviter also needs a name so the scanner sees who they're pairing with)
  - Guard: reject if current user already has `MAX_PARTNERS` accepted partnerships (no point generating a QR at cap)
- [x] `claimInvite(token: string): Promise<{ inviterName: string }>` — calls `partner.repository.claimInvite(token)` (atomic UPDATE...RETURNING). On success, creates `gym_partners` row with `status: 'pending'`. Returns inviter's display_name for confirmation.
  - Error cases: expired/already-claimed token (0 rows affected), self-pairing, already paired, invalid token
  - Guard: reject if current user has no `display_name` set (Decision 17)
  - Guard: reject if current user already has `MAX_PARTNERS` accepted partnerships
- [x] `acceptPartner(partnershipId: string): Promise<void>` — calls `updatePartnerStatus(id, 'accepted')`. State machine validation is handled in the repository layer.
- [x] `declinePartner(partnershipId: string): Promise<void>` — calls `updatePartnerStatus(id, 'declined')`
- [x] `removePartner(partnershipId: string): Promise<void>` — calls `updatePartnerStatus(id, 'removed')`

### React Query hooks

**`apps/parakeet/src/modules/gym-partners/hooks/usePartners.ts`:**

- [x] `usePartners()` — returns `{ partners, pendingRequests, isLoading }` using `partnerQueries.list()` and `partnerQueries.pendingRequests()`
- [x] `useCreateInvite()` — mutation wrapping `pairing.service.createInvite()`
- [x] `useClaimInvite()` — mutation wrapping `pairing.service.claimInvite(token)`, invalidates partner queries on success
- [x] `useAcceptPartner()` — mutation, invalidates partner + pending queries
- [x] `useDeclinePartner()` — mutation, invalidates pending queries
- [x] `useRemovePartner()` — mutation, invalidates partner queries

### QR generate UI

**`apps/parakeet/src/modules/gym-partners/ui/QrGenerateSheet.tsx`:**

- [x] Bottom sheet that displays a QR code containing the invite token
- [x] On open: calls `useCreateInvite()` mutation
- [x] Shows QR code using `react-native-qrcode-svg` (QR rendering library)
- [x] Displays countdown timer showing time remaining (5 min expiry)
- [x] When expired: shows "Expired — tap to regenerate" state
- [x] Loading and error states

### QR scan UI

**`apps/parakeet/src/modules/gym-partners/ui/QrScanSheet.tsx`:**

- [x] Bottom sheet with camera viewfinder using `react-native-vision-camera` code scanner
  - The project already uses `react-native-vision-camera` for video recording — reuse it for QR scanning via its `codeScanner` prop (NOT `expo-camera` which is not installed)
  - Configure `codeTypes: ['qr']` on the code scanner
- [x] On scan: decode QR payload, call `useClaimInvite()` mutation
- [x] Success: show "Request sent to [name]" confirmation, auto-close
- [x] Error states: expired token, already paired, self-pairing, partner cap reached, invalid QR, missing display_name
- [x] Camera permission handling (request if not granted — reuse existing permission flow from `RecordVideoSheet`)

### Partner approval screen

**`apps/parakeet/src/modules/gym-partners/ui/PartnerApprovalScreen.tsx`:**

- [x] List of pending incoming requests with partner display_name (fallback: "Partner")
- [x] Each request has Accept and Decline buttons
- [x] Accept calls `useAcceptPartner()`, Decline calls `useDeclinePartner()`
- [x] Empty state when no pending requests

### Partner management screen

**`apps/parakeet/src/modules/gym-partners/ui/PartnerManagementScreen.tsx`:**

- [x] Section: "Pending Requests" (if any) — links to approval screen or inline accept/decline
- [x] Section: "Partners" — list of accepted partners with display_name (fallback: "Partner")
- [x] Each partner row: swipe-to-remove or long-press → remove confirmation alert
- [x] "Add Partner" button → shows choice: "Show my QR" / "Scan partner's QR"
  - Disabled with explanation if user has `MAX_PARTNERS` accepted partners
- [x] Empty state: "No gym partners yet. Add one to start filming each other's lifts."

### Routes

**`apps/parakeet/src/app/settings/partners.tsx`:**

- [x] Route rendering `PartnerManagementScreen`

**`apps/parakeet/src/app/(tabs)/settings.tsx`:**

- [x] Add "Gym Partners" row in settings list, navigates to `settings/partners`
- [x] Gated by `gymPartner` feature flag

### NPM dependencies

- [x] `react-native-qrcode-svg` for QR display — add to **both** root `package.json` and `apps/parakeet/package.json` (native package autolinking requires both; see dev.md)
- [x] `react-native-svg` (likely already installed as a transitive dep — verify)
- [x] QR scanning via `react-native-vision-camera` code scanner — already installed, no new dep needed

### Barrel exports

**`apps/parakeet/src/modules/gym-partners/index.ts`:**

- [x] Export hooks: `usePartners`, `useCreateInvite`, `useClaimInvite`, `useAcceptPartner`, `useDeclinePartner`, `useRemovePartner`
- [x] Export UI: `PartnerManagementScreen`
- [x] Do NOT export `QrGenerateSheet` or `QrScanSheet` — these are internal UI details used only by `PartnerManagementScreen`

## Dependencies

- [social-001-gym-partner-db-foundation.md](./social-001-gym-partner-db-foundation.md) — tables, RLS policies, module skeleton
