---
id: EPIC-08
title: "Depth and Replayability"
day: 8
status: TODO
---

# EPIC-08 — Depth and Replayability

[Backlog index](../../BACKLOG.md) · [Operating rules](../README.md)

**Goal:** Make a second match feel different from the first, and make the opponent worth beating twice.

**Epic outcome:** The map varies per match, the camera reads as an RTS instead of a top-down view, the player can see and share the whole battlefield, and the AI keeps fighting after its first assault fails.

**Entry dependency:** [EPIC-07 — Survive and Ship](EPIC-07-release.md) must pass its ship gate.

**Ship gate:** Two matches on different seeds are visibly different maps; a defeated first AI assault is followed by another; every Day 7 check stays green.

## Tasks

- [ ] [D8-01 — Correct the camera to an isometric read](../tasks/D8-01.md) — P1 / S — depends on D7-09
- [ ] [D8-02 — Make the AI recover and keep attacking](../tasks/D8-02.md) — P1 / M — depends on D7-09
- [ ] [D8-03 — Seed map variation and enrich resources](../tasks/D8-03.md) — P1 / L — depends on D7-09
- [ ] [D8-04 — Add a minimap](../tasks/D8-04.md) — P1 / M — depends on D8-03
- [ ] [D8-05 — Make match results shareable](../tasks/D8-05.md) — P1 / M — depends on D7-09
- [ ] [D8-06 — Player-versus-player](../tasks/D8-06.md) — P2 / L — DEFERRED

## Epic completion

This epic is `DONE` only when every P1 task above is `DONE`, its ship gate has been executed, and the result is recorded in `PROJECT_STATUS.md`.
