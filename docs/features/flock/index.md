---
feature: flock
status: implemented
modules: [flock]
---

# Flock

A closed, opt-in motivational feed — your "flock" of fellow lifters. A "Flock" item in the
left drawer opens a screen showing every other lifter in the instance: their latest PR cards
and celebratory session highlights. Read-only. No health/medical data, no raw performance logs.

This is distinct from [social/](../social/index.md) (gym-partners): that feature is
_pairwise_ and _utility_ (film each other, hides real performance). Flock is
_community_ and _motivational_ (broadcasts achievements to a trusted family group).

## Design

- [design.md](./design.md) — Flock feed design, decisions, and privacy model

## Specs

| Spec                                                 | Status | Concern                                                                       |
| ---------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| [spec-data-foundation.md](./spec-data-foundation.md) | done   | Phase 1 — `flock_highlights` + `flock_config` tables, RLS, grants, repository |
| [spec-publish.md](./spec-publish.md)                 | done   | Phase 2 — publish-on-session-complete, headline derivation                    |
| [spec-ui.md](./spec-ui.md)                           | done   | Phase 3 — `flock` flag, drawer item, screen, cards, share toggle              |
