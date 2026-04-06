# social-003: Partner Session Visibility

**Status**: Done

**Design**: [gym-partner-filming.md](./design.md)

## What This Covers

Partner section on the Program screen showing each partner's active session status in realtime. Uses Supabase Realtime subscriptions to keep the UI fresh without polling. This creates the entry point for the filming flow (Spec 4).

## Tasks

### Realtime subscription

**`apps/parakeet/src/modules/gym-partners/data/partner.repository.ts`:**

- [x] `subscribeToPartnerSessions(partnerIds: string[], onUpdate: (partnerId: string) => void): () => void`
  - Creates a **single** Supabase Realtime channel using an `IN` filter for all partner IDs:
    ```ts
    const channel = typedSupabase
      .channel('partner-sessions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `user_id=in.(${partnerIds.join(',')})`,
      }, (payload) => onUpdate(payload.new.user_id))
      .subscribe()
    ```
    One channel for all partners — avoids creating N channels (one per partner) which wastes resources.
  - Prerequisite: `sessions` table must be in `supabase_realtime` publication (added in social-001 migration)
  - Cross-user RLS policy on `sessions` (from social-001) ensures Realtime only delivers events the user's RLS allows
  - Returns an unsubscribe function that removes the channel
  - Events: INSERT, UPDATE (captures session start, status changes, session end)
- [x] `fetchPartnerActiveSession(partnerId: string): Promise<{ id: string; status: string; primaryLift: string; plannedSets: unknown } | null>`
  - Queries `sessions` where `user_id = partnerId` and `status = 'in_progress'`, selects `id, status, primary_lift, planned_sets`
  - Returns `maybeSingle()` — null if no active session
  - `planned_sets` included so the filming set picker (Spec 4) can derive total set count without querying `session_logs`

### Partner session query

**`apps/parakeet/src/modules/gym-partners/data/partner.queries.ts`:**

- [x] Add `partnerSession(partnerId: string)` to query factory
  - Key: `['gym-partners', 'session', partnerId]`
  - Query: `fetchPartnerActiveSession(partnerId)`
  - `refetchInterval: false` (realtime handles freshness)

### Partner sessions hook

**`apps/parakeet/src/modules/gym-partners/hooks/usePartnerSessions.ts`:**

- [x] `usePartnerSessions()` hook:
  - Uses `usePartners()` to get accepted partner list
  - For each partner, uses `useQuery(partnerQueries.partnerSession(partnerId))`
  - Manages Realtime subscription in a `useEffect` — subscribe to all partner IDs in one channel, invalidate relevant `partnerSession` query on update
  - Returns `{ partners: Array<GymPartner & { activeSession: { id, primaryLift } | null }> }`
  - Cleans up subscription on unmount
  - When partner list changes (add/remove), unsubscribe and resubscribe with updated IDs

### Partner section UI

**`apps/parakeet/src/modules/gym-partners/ui/PartnerSection.tsx`:**

- [x] Section component for the Program screen
- [x] Header row: "GYM PARTNERS" label (tappable → navigates to management screen) + "+" button (opens QR generate sheet)
  - If pending requests exist: badge count on header (e.g., "1 pending")
- [x] Renders `PartnerCard` for each partner
- [x] Empty state: "Add a gym partner to film each other's lifts" with add button
- [x] **Self-gated by `gymPartner` feature flag** — `PartnerSection` internally calls `useFeatureEnabled('gymPartner')` and returns `null` when off. This keeps feature flag logic out of `program.tsx` (code style rule #1: zero feature knowledge in screens).

**`apps/parakeet/src/modules/gym-partners/ui/PartnerCard.tsx`:**

- [x] Card showing partner info:
  - Display name (fallback: "Partner" when null)
  - Active session: green dot + "{Lift} — Active" + enabled "Film" button
  - No active session: dimmed dot + "No active session" + disabled "Film" button
- [x] "Film" button press → navigates to partner filming flow (wired in Spec 4, placeholder onPress for now)
- [x] Style: follows existing card patterns (surface background, border, borderRadius: 12, spacing[4] padding)

### Program screen integration

**`apps/parakeet/src/app/(tabs)/program.tsx`:**

- [x] Import `PartnerSection` from `@modules/gym-partners`
- [x] Render `<PartnerSection />` unconditionally at the bottom of the ScrollView content, after week rows / unending card
  - No feature flag import in `program.tsx` — `PartnerSection` is self-gated (returns null when flag is off)

### Barrel exports

**`apps/parakeet/src/modules/gym-partners/index.ts`:**

- [x] Export: `usePartnerSessions`, `PartnerSection`
- [x] Do NOT export `PartnerCard` — internal UI detail, only used by `PartnerSection`

## Dependencies

- [social-002-qr-pairing-flow.md](./social-002-qr-pairing-flow.md) — partner list, management screen, QR sheets
