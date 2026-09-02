---
id: EPIC-04
title: "War"
day: 4
status: TODO
---

# EPIC-04 — War

[Backlog index](../../BACKLOG.md) · [Operating rules](../README.md)

**Goal:** Make robots kill robots.

**Epic outcome:** Two factions can fight through building and Core destruction to a match result.

**Entry dependency:** [EPIC-03 — Build the Colony](EPIC-03-colony.md) must pass its ship gate.

**Ship gate:** Two sides can fight, damage buildings, destroy a Core, and produce Victory or Defeat.

## Tasks

- [ ] [D4-01 — Add teams, health, damage, and destruction lifecycle](../tasks/D4-01.md) — P0 / M — depends on D1-04, D3-04
- [ ] [D4-02 — Build spatial hash and hostile target queries](../tasks/D4-02.md) — P0 / M — depends on D1-04
- [ ] [D4-03 — Implement Attack command and combat state machine](../tasks/D4-03.md) — P0 / L — depends on D1-07, D4-01, D4-02
- [ ] [D4-04 — Add readable laser/projectile and impact effects](../tasks/D4-04.md) — P0 / M — depends on D4-03
- [ ] [D4-05 — Add health bars, command markers, and death feedback](../tasks/D4-05.md) — P0 / M — depends on D4-01, D4-03
- [ ] [D4-06 — Implement Core destruction and match end](../tasks/D4-06.md) — P0 / M — depends on D4-01, D2-06
- [ ] [D4-07 — Integrate and prove the Day 4 battle gate](../tasks/D4-07.md) — P0 / M — depends on D4-04, D4-05, D4-06

## Epic completion

This epic is `DONE` only when every P0 task above is `DONE`, its ship gate has been executed, and the result is recorded in `PROJECT_STATUS.md`. P1 tasks may be `CUT` only under the cut policy in the operating rules.
