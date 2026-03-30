# social-001: Gym Partner Database Foundation

**Status**: Planned

**Design**: [gym-partner-filming.md](../../design/gym-partner-filming.md)

## What This Covers

Database tables, RLS policies, storage policies, and module skeleton for the gym partner feature. This is the foundation that all subsequent specs build on. No UI — pure data layer and infrastructure.

## Tasks

### Migration: `gym_partners` table + `gym_partner_invites` table

**`supabase/migrations/YYYYMMDD_create_gym_partners.sql`:**

- [ ] Create `gym_partners` table:
  - `id` uuid PK (gen_random_uuid)
  - `requester_id` uuid FK → profiles(id) NOT NULL
  - `responder_id` uuid FK → profiles(id) NOT NULL
  - `status` text NOT NULL DEFAULT 'pending'
  - `created_at` timestamptz DEFAULT now()
  - `updated_at` timestamptz DEFAULT now()
  - CHECK constraint: `status IN ('pending', 'accepted', 'declined', 'removed')`
  - CHECK constraint: `requester_id != responder_id` (no self-pairing)
  - Direction-agnostic UNIQUE index to prevent duplicate partnerships regardless of who requested:
    ```sql
    CREATE UNIQUE INDEX idx_gym_partners_pair
      ON gym_partners (LEAST(requester_id, responder_id), GREATEST(requester_id, responder_id))
      WHERE status != 'removed';
    ```
    This means `(A→B)` and `(B→A)` are treated as the same pair. The `WHERE status != 'removed'` allows re-pairing after removal.
- [ ] Enable RLS on `gym_partners`
- [ ] RLS SELECT: `auth.uid() = requester_id OR auth.uid() = responder_id`
- [ ] RLS INSERT: `auth.uid() = requester_id`
- [ ] RLS UPDATE: either side can update when transitioning to 'removed'; responder can update to 'accepted'/'declined'
  - `auth.uid() IN (requester_id, responder_id)` for removals
  - `auth.uid() = responder_id` for accept/decline
- [ ] Indexes:
  - `idx_gym_partners_requester` on `(requester_id) WHERE status = 'accepted'`
  - `idx_gym_partners_responder` on `(responder_id) WHERE status = 'accepted'`
- [ ] Create `gym_partner_invites` table:
  - `id` uuid PK (gen_random_uuid)
  - `inviter_id` uuid FK → profiles(id) NOT NULL
  - `token` text NOT NULL UNIQUE
  - `expires_at` timestamptz NOT NULL
  - `claimed_by` uuid FK → profiles(id) (nullable)
  - `created_at` timestamptz DEFAULT now()
- [ ] Enable RLS on `gym_partner_invites`
- [ ] RLS SELECT: `auth.uid() = inviter_id OR auth.uid() = claimed_by`
- [ ] RLS INSERT: `auth.uid() = inviter_id`
- [ ] RLS UPDATE: any authenticated user can claim (set `claimed_by`) an unclaimed, unexpired invite
- [ ] RLS DELETE: `auth.uid() = inviter_id` (inviter can clean up their own expired invites)
- [ ] Auto-cleanup trigger: on INSERT into `gym_partner_invites`, delete rows for same `inviter_id` where `expires_at < now()` (prevents unbounded accumulation of 5-minute TTL invites)
- [ ] Enable Supabase Realtime on tables needed by downstream specs:
  ```sql
  alter publication supabase_realtime add table gym_partners;
  alter publication supabase_realtime add table sessions;
  alter publication supabase_realtime add table session_videos;
  ```
  - `sessions` — required for social-003 partner session visibility (Realtime postgres_changes only fires for published tables)
  - `session_videos` — required for social-005 partner video badge (live count of new partner-recorded videos)

### Migration: `recorded_by` column on `session_videos`

**`supabase/migrations/YYYYMMDD_add_recorded_by_column.sql`:**

- [ ] `ALTER TABLE session_videos ADD COLUMN recorded_by uuid REFERENCES profiles(id)`
  - Nullable — NULL means self-recorded (backward compatible)

### Migration: Cross-user RLS policies

**`supabase/migrations/YYYYMMDD_cross_user_rls_policies.sql`:**

- [ ] New SELECT policy on `sessions`: partners can read partner's sessions
  - Policy: `auth.uid() = user_id OR EXISTS (SELECT 1 FROM gym_partners WHERE status = 'accepted' AND ((requester_id = auth.uid() AND responder_id = sessions.user_id) OR (responder_id = auth.uid() AND requester_id = sessions.user_id)))`
  - Note: add as a second SELECT policy — Postgres OR's multiple policies of the same type
  - Partners see full session rows (including `planned_sets` JSONB for set picker) — this is acceptable because `planned_sets` contains structural info (lift, set count, reps) but not actual performance data
- [ ] **No cross-user policy on `session_logs`** — `session_logs` contains `actual_sets` JSONB with weights, RPE, and failed flags. Exposing this via RLS would violate Decision 8 (minimal data visibility). Set counts for the filming set picker are derived from `sessions.planned_sets` instead.
- [ ] New INSERT policy on `session_videos`: partners can insert videos for the lifter
  - Add as a **separate** INSERT policy (Postgres OR's same-type policies):
    ```sql
    CREATE POLICY "Partners can insert videos for lifter"
      ON session_videos FOR INSERT
      WITH CHECK (
        auth.uid() = recorded_by
        AND EXISTS (
          SELECT 1 FROM gym_partners
          WHERE status = 'accepted'
          AND (
            (requester_id = auth.uid() AND responder_id = session_videos.user_id)
            OR (responder_id = auth.uid() AND requester_id = session_videos.user_id)
          )
        )
      );
    ```
  - This ensures: (a) recorder sets themselves as `recorded_by`, (b) the `user_id` being inserted is their accepted partner
  - Existing INSERT policy (`auth.uid() = user_id`) remains unchanged for self-recording
- [ ] New storage INSERT policy on `session-videos` bucket: partners can upload to `{lifterUserId}/*`
  - Add as a **separate** storage policy (keeps existing self-upload policy clean):
    ```sql
    CREATE POLICY "Partners can upload to lifter folder"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'session-videos'
        AND EXISTS (
          SELECT 1 FROM gym_partners
          WHERE status = 'accepted'
          AND (
            (requester_id = auth.uid() AND responder_id::text = (storage.foldername(name))[1])
            OR (responder_id = auth.uid() AND requester_id::text = (storage.foldername(name))[1])
          )
        )
      );
    ```

### Module skeleton: `modules/gym-partners/`

**`apps/parakeet/src/modules/gym-partners/model/types.ts`:**

- [ ] `PartnerStatus` type: `'pending' | 'accepted' | 'declined' | 'removed'`
- [ ] `GymPartner` interface: `id`, `partnerId`, `partnerName`, `status`, `createdAt`
  - `partnerId` is the other user's profile ID (resolved from requester/responder based on current user)
  - `partnerName` from joined `profiles.display_name`, fallback to `'Partner'` when null
- [ ] `PartnerInvite` interface: `id`, `token`, `expiresAt`
- [ ] `MAX_PARTNERS = 5` — app-level cap on accepted partnerships

**`apps/parakeet/src/modules/gym-partners/lib/partner-state-machine.ts`:**

- [ ] `VALID_TRANSITIONS` map: which status transitions are allowed and by whom
  - `pending → accepted` (responder only)
  - `pending → declined` (responder only)
  - `accepted → removed` (either side)
  - `pending → removed` (either side — cancel)
- [ ] `canTransition(currentStatus, targetStatus, role): boolean` — pure function
- [ ] Unit tests in `__tests__/partner-state-machine.test.ts`:
  - All valid transitions return true
  - Invalid transitions (e.g., `declined → accepted`, `removed → accepted`) return false
  - Role enforcement (requester can't accept)

**`apps/parakeet/src/modules/gym-partners/data/partner.repository.ts`:**

- [ ] `fetchAcceptedPartners(): Promise<GymPartner[]>` — query gym_partners joined with profiles
- [ ] `fetchPendingIncomingRequests(): Promise<GymPartner[]>` — where responder = auth.uid() and status = pending
- [ ] `updatePartnerStatus(id, status): Promise<void>` — accept/decline/remove
- [ ] `createInvite(): Promise<PartnerInvite>` — insert gym_partner_invites row with UUID token, 5-min expiry
- [ ] `claimInvite(token): Promise<{ inviterId: string; inviterName: string | null }>` — atomic claim via single UPDATE...RETURNING:
  ```sql
  UPDATE gym_partner_invites
  SET claimed_by = auth.uid()
  WHERE token = $1 AND claimed_by IS NULL AND expires_at > now()
  RETURNING inviter_id
  ```
  Check affected row count — 0 means expired or already claimed. Then create `gym_partners` row.

**`apps/parakeet/src/modules/gym-partners/data/partner.queries.ts`:**

- [ ] `partnerQueries` factory using `queryOptions` pattern (per react-query-patterns.md):
  - `all()` — base key `['gym-partners']`
  - `list()` — accepted partners
  - `pendingRequests()` — incoming pending requests

**`apps/parakeet/src/modules/gym-partners/index.ts`:**

- [ ] Barrel exports: types (`PartnerStatus`, `GymPartner`, `PartnerInvite`, `MAX_PARTNERS`), state machine (`canTransition`, `VALID_TRANSITIONS`), query factories (`partnerQueries`)
- [ ] **Do NOT export repository functions** — they are internal, consumed by the module's own hooks and services (per code style rule #16)

### Feature flag

**`apps/parakeet/src/modules/feature-flags/model/features.ts`:**

- [ ] Add `gymPartner` to `FEATURE_REGISTRY`:
  - `id: 'gymPartner'`
  - `label: 'Gym Partner Filming'`
  - `description: 'Pair with gym partners to film each other\'s lifts'`
  - `category: 'advanced'`
  - `defaultEnabled: false`

### Type generation

- [ ] Run `npm run db:types` to regenerate `supabase/types.ts` after migrations

## Dependencies

None — this is the foundation spec.
