---
feature: settings-and-tools
status: partial
modules: [settings]
---
# Settings & Tools

Feature flags, bar weight, data export, CSV import, and schedule change days.

## Design
- [design-feature-flags.md](./design-feature-flags.md) — Feature flag system
- [design-bar-weight.md](./design-bar-weight.md) — Bar weight configuration
- [design-export.md](./design-export.md) — Data export design
- [design-csv-import.md](./design-csv-import.md) — CSV import tool design
- [design-change-days.md](./design-change-days.md) — Schedule change days design

## Specs
| Spec | Status | Concern |
|------|--------|---------|
| [spec-bar-weight.md](./spec-bar-weight.md) | done | Bar weight setting |
| [spec-export.md](./spec-export.md) | done | Data export feature |
| [spec-feature-flags.md](./spec-feature-flags.md) | done | Feature flag system |
| spec-csv-import.md | _missing_ | CSV import — design exists but no spec yet |
| spec-change-days.md | _missing_ | Change-days — design exists but no spec yet |

The CSV import and change-days designs exist (`design-csv-import.md`, `design-change-days.md`) but no implementation spec has been written. Either fold each design's tasks into a spec doc, or move the design docs into `_archive/` if those features are no longer planned.
