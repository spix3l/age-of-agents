---
id: EPIC-07
title: "Survive and Ship"
day: 7
status: REVIEW
---

# EPIC-07 — Survive and Ship

[Backlog index](../../BACKLOG.md) · [Operating rules](../README.md)

**Goal:** Freeze, stabilize, and ship.

**Epic outcome:** The static production build completes a full match reliably in supported browsers.

**Entry dependency:** [EPIC-06 — Evolution](EPIC-06-evolution.md) must pass its ship gate.

**Ship gate:** A clean production build completes a full match in supported browsers without console intervention.

## Tasks

- [x] [D7-01 — Freeze scope and build the release bug board](../tasks/D7-01.md) — P0 / S — depends on D5-07, D6-01
- [x] [D7-02 — Add full-loop smoke and invariant tests](../tasks/D7-02.md) — P0 / L — depends on D7-01
- [x] [D7-03 — Fix navigation and stuck-unit release blockers](../tasks/D7-03.md) — P0 / L — depends on D7-01
- [x] [D7-04 — Profile and optimize large battles](../tasks/D7-04.md) — P0 / L — depends on D7-01
- [ ] [D7-05 — Balance match pacing and AI reliability](../tasks/D7-05.md) — P0 / L — depends on D7-01
- [x] [D7-06 — Perform keyboard/mouse UX and browser QA](../tasks/D7-06.md) — P0 / M — depends on D7-02, D7-03
- [x] [D7-07 — Verify static production deployment](../tasks/D7-07.md) — P0 / M — depends on D7-02, D7-04
- [x] [D7-08 — Finalize project status and agent handoff](../tasks/D7-08.md) — P0 / S — depends on D7-05, D7-06, D7-07
- [ ] [D7-09 — Execute clean-browser release playthrough](../tasks/D7-09.md) — P0 / M — depends on D7-08

## Epic completion

This epic is `DONE` only when every P0 task above is `DONE`, its ship gate has been executed, and the result is recorded in `PROJECT_STATUS.md`. P1 tasks may be `CUT` only under the cut policy in the operating rules.

## Ship gate result — 2026-09-03

The gate is executed and green: a clean production build, served from static
files by `vite preview`, completes a full match in Chromium and Firefox with no
console intervention. `scripts/browser-qa.mjs --headed --full` passes 33/33,
including an unattended match through the end screen, Main Menu, and a clean new
match. Details are in `PERFORMANCE.md` and `QA.md`.

The epic stays `REVIEW` rather than `DONE` because two P0 tasks keep an
explicitly recorded human remainder:

- **D7-05** — the three *active* playtests need a person at the controls. The
  fifteen unattended soaks are recorded and green.
- **D7-09** — the hands-on browser playthrough needs a person. The unattended
  half passes against the production preview, and the player-driven flow is
  asserted end to end by `definitionOfDone.integration.test.ts`.

Mark the epic `DONE` once the project owner records those two sessions.
