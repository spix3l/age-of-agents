---
id: EPIC-03
title: "Build the Colony"
day: 3
status: TODO
---

# EPIC-03 — Build the Colony

[Backlog index](../../BACKLOG.md) · [Operating rules](../README.md)

**Goal:** Turn an economy into a base.

**Epic outcome:** The player can construct capacity and production infrastructure and automate the economy.

**Entry dependency:** [EPIC-02 — The Machine Economy](EPIC-02-economy.md) must pass its ship gate.

**Ship gate:** The player can place and complete a Relay Node and Fabricator, then queue Strikers. Automated Workers repeat gathering.

## Tasks

- [ ] [D3-01 — Implement placement validation and building ghosts](../tasks/D3-01.md) — P0 / L — depends on D1-06, D2-01
- [ ] [D3-02 — Implement construction sites and Worker building](../tasks/D3-02.md) — P0 / L — depends on D2-02, D3-01
- [ ] [D3-03 — Add Relay Node capacity integration](../tasks/D3-03.md) — P0 / S — depends on D2-04, D3-02
- [ ] [D3-04 — Add Fabricator and Striker production](../tasks/D3-04.md) — P0 / M — depends on D2-05, D3-02
- [ ] [D3-05 — Add queue UI and cancel/refund behavior](../tasks/D3-05.md) — P0 / M — depends on D2-06, D3-04
- [ ] [D3-06 — Implement persistent economic automation](../tasks/D3-06.md) — P0 / M — depends on D2-02
- [ ] [D3-07 — Implement rally points](../tasks/D3-07.md) — P1 / S — depends on D3-04
- [ ] [D3-08 — Integrate and prove the Day 3 colony gate](../tasks/D3-08.md) — P0 / M — depends on D3-03, D3-04, D3-05, D3-06

## Epic completion

This epic is `DONE` only when every P0 task above is `DONE`, its ship gate has been executed, and the result is recorded in `PROJECT_STATUS.md`. P1 tasks may be `CUT` only under the cut policy in the operating rules.
