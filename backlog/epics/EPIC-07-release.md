---
id: EPIC-07
title: "Survive and Ship"
day: 7
status: TODO
---

# EPIC-07 — Survive and Ship

[Backlog index](../../BACKLOG.md) · [Operating rules](../README.md)

**Goal:** Freeze, stabilize, and ship.

**Epic outcome:** The static production build completes a full match reliably in supported browsers.

**Entry dependency:** [EPIC-06 — Evolution](EPIC-06-evolution.md) must pass its ship gate.

**Ship gate:** A clean production build completes a full match in supported browsers without console intervention.

## Tasks

- [ ] [D7-01 — Freeze scope and build the release bug board](../tasks/D7-01.md) — P0 / S — depends on D5-07, D6-01
- [ ] [D7-02 — Add full-loop smoke and invariant tests](../tasks/D7-02.md) — P0 / L — depends on D7-01
- [ ] [D7-03 — Fix navigation and stuck-unit release blockers](../tasks/D7-03.md) — P0 / L — depends on D7-01
- [ ] [D7-04 — Profile and optimize large battles](../tasks/D7-04.md) — P0 / L — depends on D7-01
- [ ] [D7-05 — Balance match pacing and AI reliability](../tasks/D7-05.md) — P0 / L — depends on D7-01
- [ ] [D7-06 — Perform keyboard/mouse UX and browser QA](../tasks/D7-06.md) — P0 / M — depends on D7-02, D7-03
- [ ] [D7-07 — Verify static production deployment](../tasks/D7-07.md) — P0 / M — depends on D7-02, D7-04
- [ ] [D7-08 — Finalize project status and agent handoff](../tasks/D7-08.md) — P0 / S — depends on D7-05, D7-06, D7-07
- [ ] [D7-09 — Execute clean-browser release playthrough](../tasks/D7-09.md) — P0 / M — depends on D7-08

## Epic completion

This epic is `DONE` only when every P0 task above is `DONE`, its ship gate has been executed, and the result is recorded in `PROJECT_STATUS.md`. P1 tasks may be `CUT` only under the cut policy in the operating rules.
