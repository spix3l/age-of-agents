---
id: EPIC-01
title: "The World"
day: 1
status: DONE
---

# EPIC-01 — The World

[Backlog index](../../BACKLOG.md) · [Operating rules](../README.md)

**Goal:** Make the build feel like an RTS.

**Epic outcome:** A production-shaped world where the player can select 30 units and route them around blockers.

**Entry dependency:** None.

**Ship gate:** A production-shaped dev build can select 30 units and route them around blockers.

## Tasks

- [x] [D1-01 — Scaffold the application and quality gates](../tasks/D1-01.md) — P0 / M — depends on —
- [x] [D1-02 — Define simulation contracts and balance data](../tasks/D1-02.md) — P0 / M — depends on D1-01
- [x] [D1-03 — Build the Three.js world shell](../tasks/D1-03.md) — P0 / M — depends on D1-01
- [x] [D1-04 — Implement fixed-step game loop and entity registry](../tasks/D1-04.md) — P0 / M — depends on D1-02, D1-03
- [x] [D1-05 — Implement RTS camera controls and bounds](../tasks/D1-05.md) — P0 / S — depends on D1-03
- [x] [D1-06 — Build navigation grid and A*](../tasks/D1-06.md) — P0 / L — depends on D1-02
- [x] [D1-07 — Implement unit movement and group destination slots](../tasks/D1-07.md) — P0 / L — depends on D1-04, D1-06
- [x] [D1-08 — Implement click and drag-box selection](../tasks/D1-08.md) — P0 / M — depends on D1-04, D1-05
- [x] [D1-09 — Integrate and prove the Day 1 world gate](../tasks/D1-09.md) — P0 / M — depends on D1-07, D1-08

## Epic completion

This epic is `DONE` only when every P0 task above is `DONE`, its ship gate has been executed, and the result is recorded in `PROJECT_STATUS.md`. P1 tasks may be `CUT` only under the cut policy in the operating rules.
