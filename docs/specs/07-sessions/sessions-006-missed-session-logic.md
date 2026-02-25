# Spec: Missed Session Detection & Makeup Window

**Status**: Planned
**Domain**: Sessions

## What This Covers

Logic for detecting missed sessions, the within-week makeup window, and the conservative load adjustment the JIT generator applies after a session goes unworked for more than 7 days.

## Tasks

### Missed Session Detection

**File: `apps/parakeet/src/lib/sessions.ts`**

A session transitions to `missed` status automatically. A background check runs when the user opens the app (on app foreground), comparing all `scheduled` sessions against the current date:

```typescript
export async function markMissedSessions(userId: string): Promise<void> {
  const now = new Date()
  const { data: scheduled } = await supabase
    .from('sessions')
    .select('id, scheduled_date, lift, week_number')
    .eq('user_id', userId)
    .eq('status', 'scheduled')
    .lt('scheduled_date', now.toISOString().split('T')[0])  // past dates only

  for (const session of scheduled ?? []) {
    const isPastMakeupWindow = isMakeupWindowExpired(session, now)
    if (isPastMakeupWindow) {
      await supabase
        .from('sessions')
        .update({ status: 'missed', missed_at: now.toISOString() })
        .eq('id', session.id)
    }
  }
}
```

---

### Makeup Window Logic

**File: `packages/training-engine/src/sessions/makeup-window.ts`**

```typescript
interface SessionRef {
  id: string
  scheduledDate: string      // ISO date
  lift: Lift
  weekNumber: number
}

interface MakeupWindowInput {
  missedSession: SessionRef
  allSessionsThisCycle: SessionRef[]   // needed to find "next same lift" session
  today: Date
}

export function isMakeupWindowExpired(input: MakeupWindowInput): boolean
```

**Rules:**
1. Find the next scheduled session of the **same lift** in the same program that occurs **after** `missedSession.scheduledDate`
2. Makeup window end = day before that next session's scheduled date
3. If no next session of that lift exists (last in cycle): makeup window = end of the same calendar week (Sunday)
4. If `today > makeupWindowEnd` → expired → session is missed
5. If `today <= makeupWindowEnd` → still within window → session remains `scheduled` (user can still complete it)

**Important:** Makeup does not extend beyond the same week unless there is no next session of that lift at all in the cycle.

**Unit tests (`packages/training-engine/src/sessions/makeup-window.test.ts`):**
- [ ] Missed Monday squat, next squat Friday → window ends Thursday → today=Wednesday → not expired
- [ ] Missed Monday squat, next squat Friday → today=Friday → expired
- [ ] Missed last squat of cycle → window = end of same week
- [ ] Missed session, no next session of that lift → window = Sunday of same week

---

### `daysSinceLastSession` Recency Signal

**File: `apps/parakeet/src/lib/sessions.ts`** — extend `getJITInputForSession()`:

```typescript
// For a given lift, find the most recent COMPLETED session of that lift
const lastCompleted = await supabase
  .from('sessions')
  .select('completed_at')
  .eq('user_id', userId)
  .eq('primary_lift', lift)
  .eq('status', 'completed')
  .order('completed_at', { ascending: false })
  .limit(1)

const daysSinceLastSession = lastCompleted.data?.[0]
  ? differenceInDays(new Date(), new Date(lastCompleted.data[0].completed_at))
  : null   // null = no history (first session)
```

Passed into `JITInput.daysSinceLastSession`. Already used by the JIT generator's recency modifier (engine-007). This spec documents where the value is computed.

**Recency modifier reference (from engine-007):**
- `> 7 days`: conservative modifier — treat like mild disruption for volume, not intensity
- `> 14 days`: stronger conservative modifier
- `null` (first session): use block-1 week-1 defaults, no recency modifier

---

### Makeup Session Display

**`apps/parakeet/app/(tabs)/today.tsx`** — visual treatment:

- Sessions within their makeup window show an **amber "Makeup" badge** on the session card
- Missed sessions (window expired) show a **grey overlay** + "Missed" badge
- The Today tab always shows the chronologically next incomplete session — if a makeup session is available, it surfaces above the next scheduled session

**`apps/parakeet/app/(tabs)/today.tsx`** — session card order:
1. Active makeup sessions (in makeup window, not yet completed) — amber badge
2. Today's scheduled session (if any)
3. Next scheduled session (if today has none)

## Dependencies

- [engine-007-jit-session-generator.md](../04-engine/engine-007-jit-session-generator.md) — consumes `daysSinceLastSession`
- [sessions-002-session-lifecycle-api.md](./sessions-002-session-lifecycle-api.md) — session status transitions
- [mobile-004-today-screen.md](../09-mobile/mobile-004-today-screen.md) — makeup badge display
