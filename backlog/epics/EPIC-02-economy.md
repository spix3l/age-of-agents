---
id: EPIC-02
title: "The Machine Economy"
day: 2
status: DONE
---

# EPIC-02 — The Machine Economy

[Backlog index](../../BACKLOG.md) · [Operating rules](../README.md)

**Goal:** Make resources matter.

**Epic outcome:** The normal starting state supports gathering Matter and Energy and producing more Workers.

**Entry dependency:** [EPIC-01 — The World](EPIC-01-world.md) must pass its ship gate.

**Ship gate:** Starting with one Core and three Workers, the player can gather Matter/Energy and queue more Workers without debug tools.

## Tasks

- [x] [D2-01 — Add player economy and resource-node model](../tasks/D2-01.md) — P0 / M — depends on D1-04
- [x] [D2-02 — Implement Worker gathering state machine](../tasks/D2-02.md) — P0 / L — depends on D1-07, D2-01
- [x] [D2-03 — Add Core, ownership, and deposits](../tasks/D2-03.md) — P0 / M — depends on D1-04, D2-01
- [x] [D2-04 — Implement Agent Capacity rules](../tasks/D2-04.md) — P0 / S — depends on D1-02, D2-03
- [x] [D2-05 — Implement production queues and Worker spawning](../tasks/D2-05.md) — P0 / M — depends on D2-03, D2-04
- [x] [D2-06 — Build resource, selection, and Core action HUD](../tasks/D2-06.md) — P0 / L — depends on D2-01, D2-05
- [x] [D2-07 — Create fair starting state and economy tests](../tasks/D2-07.md) — P0 / M — depends on D2-02, D2-05, D2-06

## Epic completion

This epic is `DONE` only when every P0 task above is `DONE`, its ship gate has been executed, and the result is recorded in `PROJECT_STATUS.md`. P1 tasks may be `CUT` only under the cut policy in the operating rules.
