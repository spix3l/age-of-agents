# Agent Handoff

Read `PRD.md`, `BACKLOG.md`, and `PROJECT_STATUS.md` before changing code. Task files under `backlog/tasks/` are the authoritative work contracts.

## Run the project

```sh
npm install
npm run dev
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

## Architecture map

- `src/game/Game.ts` is the composition root and the human command adapter. Keep it thin.
- `src/game/building/PlacementController.ts` owns snapped placement state and authoritative validation. `Game.ts` confirms placement by spending, creating the site, blocking its footprint, and assigning a builder as one rollback-safe transaction.
- `src/game/GameState.ts` owns separate unit, building, and resource registries plus faction economies.
- `src/game/economy/` owns atomic ledgers and used/reserved/max Agent Capacity. Extend these instead of storing balances on UI objects.
- `src/game/entities/resources/` owns finite resource-node state; `src/game/entities/buildings/Core.ts` owns the first building contract.
- `src/game/commands/GatherCommand.ts`, `MoveCommand.ts`, `AutomateCommand.ts`, and `AttackCommand.ts` are player/AI-safe command boundaries.
- `src/game/combat/` owns hostility rules, `DamageService` (the only HP writer), the shared `destruction.ts` cleanup, and `MatchStats` attribution.
- `src/game/spatial/SpatialHash.ts` backs all nearby-target queries. Re-sync it once per simulation step; never scan every entity.
- `src/game/match/MatchState.ts` owns the single Victory/Defeat transition; `BattleSimulation.ts` is the headless twin of the rendered match for combat and future AI soak tests.
- `src/game/rendering/EffectsManager.ts` pools all combat visuals and is driven only by presentation hooks.
- `src/game/systems/GatheringSystem.ts`, `ConstructionSystem.ts`, `AutomationSystem.ts`, `ProductionSystem.ts`, and `CombatSystem.ts` advance only from fixed simulation delta time.
- `src/game/economy/CapacityProviders.ts` applies and removes completed-building capacity without coupling it to rendering or destruction effects.
- `src/game/scenarios/economy.ts` is the shipping opening scenario; `battle.ts` holds the mirrored Day 4 debug armies (`?scenario=battle`); `day1.ts` remains the 30-unit navigation fixture. Build units only through `createUnitEntity`/`createWorkerEntity`, never entity literals.
- `src/game/world/createMatch.ts` is the seeded match entrypoint; `WorldScene.ts` is presentation only.
- `src/game/input/InputManager.ts` is the only raw pointer-event adapter. Right-click is contextual in `Game.ts`.
- `src/ui/store.ts` exposes throttled HUD snapshots and command callbacks; never publish per-frame transforms there.
- `src/data/` is the only home for gameplay balance constants.

## Important invariants

- Every entity has a stable validated ID; labels are never identity.
- Simulation uses `{ x, z }`; Three.js maps this onto its XZ ground plane.
- Only a faction's deposit-capable structures accept that faction's cargo.
- Spending is atomic. Costs are charged and capacity reserved at enqueue, then reservation is committed only on successful spawn.
- A destroyed provider lowers maximum capacity without deleting already-used slots. Unit destruction callers must release used capacity.
- Gather orders survive normal repathing. A manual move explicitly cancels gathering.
- Buildings update navigation occupancy through `NavigationGrid`; its reference counts must remain balanced.
- A construction site is non-operational until complete. Cancelling one unblocks its footprint, clears its builder order, and refunds 75%.
- Automation persists through normal gather/deposit cycles; explicit move, gather, or build orders cancel the automation mode.
- Core and Fabricator production share one FIFO queue. Costs and capacity are reserved on enqueue; user cancellation refunds both in full.
- Selection may include player units/buildings and neutral resources, never enemy entities.
- React receives UI snapshots at 10 Hz. Simulation code cannot import React.
- New browser listeners, animation frames, Three.js resources, and observers must be disposed on remount.
- Human and future AI actions should converge on the same command/system boundaries.
- Only `DamageService` writes HP. It rejects friendly fire and queues each death once; deaths are processed after every system has finished iterating.
- Destroyed entities must go through `destroyEntity`. Never unregister an entity inline from a system loop.
- Target acquisition runs at 5 Hz for idle auto-acquiring units only. Do not acquire targets per render frame.
- Combat effects are presentational: a missing or dropped effect can never change damage, hits, or deaths.
- Once `MatchState` is over, the simulation and every command are frozen. Play Again remounts `Game` through the store's match nonce.

## Day 4 controls and completion state

Right-click is contextual for the current selection: an enemy Agent or structure issues **Attack**, an unfinished friendly site assigns a builder, a live resource issues **Gather**, and terrain issues **Move**. Selected Strikers pursue an ordered target anywhere; idle Strikers automatically engage hostiles inside their vision. Workers defend themselves only when explicitly ordered.

Health bars appear on damaged or selected units and buildings. Destroying either Core ends the match once, freezes the simulation, and shows the Victory/Defeat screen with match statistics and **Play Again**. **Main Menu** stays disabled until D6-01.

`/?scenario=battle` starts the mirrored debug armies used by the Day 4 gate.

Epics 01 through 04 are complete. The user accepted the Day 4 battle gate on 2026-09-02. Begin Epic 05 with D5-01 by driving the existing command boundaries (`MoveCommand`, `GatherCommand`, `AttackCommand`, `ProductionSystem`, `PlacementController`) from an AI controller — do not add a parallel action path.

## Day 3 controls and completion state

The shipping scenario starts each faction with one Core, three Workers, 25 Matter, 20 Energy, and 8 Agent Capacity. Left-click selects a Worker, building, or resource; Shift and drag-box operate on friendly Workers. Right-click terrain moves selected units. Right-click a live resource to gather, or an unfinished friendly site to reassign a selected Worker as builder.

Selected Workers expose Relay/Fabricator placement and persistent **Auto Matter** / **Auto Energy** modes. Relay placement costs 80 Matter and 20 Energy; completion adds five capacity. Fabricator placement costs 160 Matter and 80 Energy; once complete it fabricates Strikers through the visible FIFO queue. Click a construction site's cancel control for a 75% refund or a queued production row for a full refund.

Camera input remains layout-aware ZQSD on AZERTY plus arrow keys; two-finger trackpad scrolling pans and pinching zooms.

Epics 01 through 03 are complete. The user accepted Epic 03's colony gate on 2026-09-02, and its automated checks are green. D3-07 rally points were intentionally cut as optional P1 scope.
