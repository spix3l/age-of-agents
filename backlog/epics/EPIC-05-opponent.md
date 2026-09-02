---
id: EPIC-05
title: "The Other Intelligence"
day: 5
status: TODO
---

# EPIC-05 — The Other Intelligence

[Backlog index](../../BACKLOG.md) · [Operating rules](../README.md)

**Goal:** Create an opponent capable of winning.

**Epic outcome:** A deterministic local AI can execute the entire economy-to-conquest loop.

**Entry dependency:** [EPIC-04 — War](EPIC-04-war.md) must pass its ship gate.

**Ship gate:** If the player does nothing, the AI builds an economy and army, discovers the player, and can destroy the player's Core.

## Tasks

- [ ] [D5-01 — Create AI controller, utility states, and command adapter](../tasks/D5-01.md) — P0 / M — depends on D3-08, D4-07
- [ ] [D5-02 — Implement AI gathering and Worker production](../tasks/D5-02.md) — P0 / L — depends on D5-01
- [ ] [D5-03 — Implement AI building and capacity management](../tasks/D5-03.md) — P0 / L — depends on D5-01, D5-02
- [ ] [D5-04 — Implement AI military production and army assembly](../tasks/D5-04.md) — P0 / M — depends on D5-03
- [ ] [D5-05 — Implement AI scouting, defense, attack, and recovery](../tasks/D5-05.md) — P0 / L — depends on D5-04
- [ ] [D5-06 — Add AI observability and deterministic soak scenario](../tasks/D5-06.md) — P0 / M — depends on D5-05
- [ ] [D5-07 — Balance and prove the Day 5 opponent gate](../tasks/D5-07.md) — P0 / L — depends on D5-06

## Epic completion

This epic is `DONE` only when every P0 task above is `DONE`, its ship gate has been executed, and the result is recorded in `PROJECT_STATUS.md`. P1 tasks may be `CUT` only under the cut policy in the operating rules.
