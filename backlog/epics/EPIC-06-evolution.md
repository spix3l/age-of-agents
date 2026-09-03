---
id: EPIC-06
title: "Evolution"
day: 6
status: REVIEW
---

# EPIC-06 — Evolution

[Backlog index](../../BACKLOG.md) · [Operating rules](../README.md)

**Goal:** Turn the prototype into Age of Agents.

**Epic outcome:** Onboarding is complete and the highest-value identity features fit without destabilizing P0.

**Entry dependency:** [EPIC-05 — The Other Intelligence](EPIC-05-opponent.md) must pass its ship gate.

**Ship gate:** P0 remains green; Generation progression and the highest-value P1 slices that fit are playable.

## Tasks

- [ ] [D6-01 — Add main menu, how-to-play, and match restart](../tasks/D6-01.md) — P0 / M — depends on D4-06
- [ ] [D6-02 — Add Data and three-Generation progression](../tasks/D6-02.md) — P1 / L — depends on D5-07
- [ ] [D6-03 — Implement grid Fog of War](../tasks/D6-03.md) — P1 / L — depends on D4-02, D5-07
- [ ] [D6-04 — Add Ranger to the Fabricator](../tasks/D6-04.md) — P1 / M — depends on D4-03, D6-02
- [ ] [D6-05 — Add Scout Drone and exploration role](../tasks/D6-05.md) — P1 / M — depends on D6-03, D6-02
- [ ] [D6-06 — Add Heavy Foundry and Titan](../tasks/D6-06.md) — P1 / L — depends on D3-02, D4-03, D6-02
- [ ] [D6-07 — Add automatic Defense Turret](../tasks/D6-07.md) — P1 / M — depends on D3-02, D4-03, D6-02
- [ ] [D6-08 — Add essential audio with safe fallbacks](../tasks/D6-08.md) — P1 / M — depends on D4-04, D6-01
- [ ] [D6-09 — Establish low-poly faction identity and generation cues](../tasks/D6-09.md) — P1 / M — depends on D6-02
- [ ] [D6-10 — Add end-game statistics](../tasks/D6-10.md) — P1 / M — depends on D4-06, D6-01
- [ ] [D6-11 — Run external-tester usability pass and triage](../tasks/D6-11.md) — P0 / M — depends on D6-01
- [ ] [D6-12 — Add modular Barrier Walls](../tasks/D6-12.md) — P1 / S — depends on D3-02, D4-01
- [ ] [D6-13 — Add remote-deposit Field Outpost](../tasks/D6-13.md) — P1 / M — depends on D2-03, D3-02, D6-03
- [ ] [D6-14 — Double the battlefield and refill it](../tasks/D6-14.md) — P1 / M — depends on D6-03
- [ ] [D6-15 — Make colonies buildable as villages](../tasks/D6-15.md) — P1 / M — depends on D6-12, D6-13
- [ ] [D6-16 — Give every structure real Generation upgrades](../tasks/D6-16.md) — P1 / M — depends on D6-02, D6-09

## Epic completion

This epic is `DONE` only when every P0 task above is `DONE`, its ship gate has been executed, and the result is recorded in `PROJECT_STATUS.md`. P1 tasks may be `CUT` only under the cut policy in the operating rules.
