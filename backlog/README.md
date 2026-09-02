# Backlog operating rules

[Portfolio index](../BACKLOG.md)

This is the execution backlog for `PRD.md`. It is intentionally optimized for a playable P0 game by the end of Day 5, selective P1 work on Day 6, and a hard feature freeze on Day 7.

## How agents use this backlog

1. Pick only a task whose dependencies are `DONE`.
2. Before coding, set the task file's frontmatter status to `IN PROGRESS`, add your name in `owner`, and mirror the status in the portfolio index.
3. Read `PRD.md` and, once D1-01 creates them, `PROJECT_STATUS.md` and `AGENT_HANDOFF.md` before changing code.
4. Stay inside the task's **Owns** paths where possible. Coordinate before editing a path owned by another in-progress task.
5. Keep the project runnable. Run the task's checks and relevant existing checks before handoff.
6. Finish one task by updating its task file, its epic checkbox, the portfolio status, `PROJECT_STATUS.md`, and `AGENT_HANDOFF.md` when architecture or operating instructions changed.
7. If blocked, mark `BLOCKED` and record the exact blocker. Do not silently broaden scope.

Status values: `TODO`, `IN PROGRESS`, `BLOCKED`, `REVIEW`, `DONE`, `CUT`.

Priority meanings:

- **P0**: required for a complete playable match and static build.
- **P1**: start only after the day's P0 gate passes.
- **P2**: explicitly excluded from the committed seven-day plan.

Estimate meanings are agent-active engineering time, not elapsed wall time: `S` is up to 90 minutes, `M` is 1.5–3 hours, and `L` is 3–5 hours. If an `L` task grows beyond five hours, stop and split or simplify it.

## Scope decisions for the seven-day build

- The first playable map is handcrafted and deterministic. Seeded resource variation is P1 and procedural terrain is cut.
- The Ranger Facility is merged into the Fabricator.
- Data, Generations, Ranger, Scout Drone, Titan, Defense Turret, and Fog of War remain Day 6 P1 work.
- Economic automation is promoted to the ship path because the Definition of Done and core product fantasy require it.
- Rally points are included only after production queues are stable.
- Research Array, minimap, upgrades, control groups, advanced military automation, save games, and sophisticated local avoidance are not committed.
- Primitive/generated geometry is acceptable for all V1 assets. No external asset pipeline may block gameplay.
- AI may use known resource locations, but it must discover the player's Core before launching an attack against it.

## Integration rules

- `main` should always start and build. Use short-lived branches or isolated worktrees if the agent environment supports them.
- One task should produce one focused commit. Do not mix drive-by refactors into feature work.
- The integration owner resolves shared-file changes; feature agents should avoid broad formatting passes.
- Shared hotspots are `src/game/Game.ts`, `src/game/GameState.ts`, `src/data/*`, and `src/ui/AppHud.tsx`. Prefer new modules and narrow wiring changes.
- Simulation code cannot import React. React may read snapshots/selectors and submit commands, but it does not own per-frame entity state.
- Human and AI actions must pass through the same command interface.
- All timers use simulation delta time. Gameplay numbers belong under `src/data/`.
- A task is not `DONE` when it only compiles; every acceptance item and verification command must pass.

## Daily ship gates

| Day | Gate that must pass before stopping |
|---|---|
| 1 — World | A production-shaped dev build can select 30 units and route them around blockers. |
| 2 — Economy | Starting with one Core and three Workers, the player can gather Matter/Energy and queue more Workers without debug tools. |
| 3 — Colony | The player can place and complete a Relay Node and Fabricator, then queue Strikers. Automated Workers repeat gathering. |
| 4 — War | Two sides can fight, damage buildings, destroy a Core, and produce Victory or Defeat. |
| 5 — Opponent | If the player does nothing, the AI builds an economy and army, discovers the player, and can destroy the player's Core. |
| 6 — Identity | P0 remains green; Generation progression and the highest-value P1 slices that fit are playable. |
| 7 — Ship | A clean production build completes a full match in supported browsers without console intervention. |

## Cut order

If a daily gate is at risk, cut work in this order: D6-09 cosmetic polish, D6-08 audio, D6-07 turret, D6-06 Titan, D6-05 Scout Drone, D6-04 Ranger, D6-03 Fog of War, D6-02 Generations/Data. Never cut a complete P0 economy → construction → production → combat → AI → match-end loop.

## Source of truth

Each file under `tasks/` is authoritative for that task's status, owner, dependencies, acceptance criteria, and verification. Epic checkboxes and the portfolio index are roll-ups: update them in the same change whenever a task status changes.

Epic frontmatter is authoritative for epic status. Mark an epic `DONE` only after its P0 tasks and ship gate pass.
