---
feature: session
status: implemented
modules: [session]
---
# Session

Session lifecycle, logging, completion, performance, and motivational messaging.

## Design
- [design-adhoc.md](./design-adhoc.md) — Ad-hoc session design
- [design-logging.md](./design-logging.md) — Set logging design
- [design-durability.md](./design-durability.md) — Per-set durability; prevents data loss when End is not tapped

## Specs
| Spec | Status | Concern |
|------|--------|---------|
| [spec-read.md](./spec-read.md) | done | Session read API |
| [spec-lifecycle.md](./spec-lifecycle.md) | done (update pending) | Session start/end lifecycle; stale-session handling branches on `set_logs` |
| [spec-completion.md](./spec-completion.md) | done (update pending) | End-of-workout summary; sets persisted separately |
| [spec-performance.md](./spec-performance.md) | done | In-session performance tracking |
| [spec-missed.md](./spec-missed.md) | done | Missed session handling |
| [spec-adhoc.md](./spec-adhoc.md) | done | Ad-hoc session creation |
| [spec-planned-set-display.md](./spec-planned-set-display.md) | done | Planned set display logic |
| [spec-today.md](./spec-today.md) | done | Today's session screen |
| [spec-logging.md](./spec-logging.md) | done | Set logging UI |
| [spec-offline.md](./spec-offline.md) | done (update pending) | Offline session support; queue carries per-set ops |
| [spec-motivational.md](./spec-motivational.md) | done | Motivational messaging |
| [spec-set-persistence.md](./spec-set-persistence.md) | done | Append-only `set_logs`; all reads cut over; JSONB column drop documented + coordinated |
| [spec-auto-finalize.md](./spec-auto-finalize.md) | done | Server auto-finalise + Sentry breadcrumb + client recovery hook |
