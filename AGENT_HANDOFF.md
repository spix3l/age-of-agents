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

- `src/game/match/MatchSimulation.ts` is the authoritative match: entities, economies, every fixed-step system, destruction, and match end, with no Three.js, DOM, or React. Add simulation behavior here.
- `src/game/Game.ts` is the presentation shell: renderer, camera, input, selection, placement, and HUD wiring around one `MatchSimulation`. Keep it thin and keep simulation logic out of it.
- `src/game/ai/` is the opponent: `AIController` (3 Hz tick, memory, slices), `AIStrategy` (pure utility scoring), `AIContext` (read-only view + command adapter), `EconomyAI`, `BuildPlanner`, `MilitaryAI`, `AIKnowledge`.
- `src/game/debug/` holds the category `Logger` and `runSoak`, the deterministic unattended match report used by the Day 5 gate.
- `src/game/util/Random.ts` is the only sanctioned source of randomness; seed it, never call `Math.random`.
- `src/game/building/PlacementController.ts` owns snapped placement state and authoritative validation. `Game.ts` confirms placement by spending, creating the site, blocking its footprint, and assigning a builder as one rollback-safe transaction.
- `src/game/GameState.ts` owns separate unit, building, and resource registries plus faction economies.
- `src/game/economy/` owns atomic ledgers and used/reserved/max Agent Capacity. Extend these instead of storing balances on UI objects.
- `src/game/entities/resources/` owns finite resource-node state; `src/game/entities/buildings/Core.ts` owns the first building contract.
- `src/game/commands/GatherCommand.ts`, `MoveCommand.ts`, `AutomateCommand.ts`, `AttackCommand.ts`, and `BuildCommand.ts` are player/AI-safe command boundaries.
- `src/game/combat/` owns hostility rules, `DamageService` (the only HP writer), the shared `destruction.ts` cleanup, and `MatchStats` attribution.
- `src/game/spatial/SpatialHash.ts` backs all nearby-target queries. Re-sync it once per simulation step; never scan every entity.
- `src/game/match/MatchState.ts` owns the single Victory/Defeat transition.
- `src/game/rendering/EffectsManager.ts` pools all combat visuals and is driven only by presentation hooks.
- `src/game/systems/TechnologySystem.ts` is the authoritative Awakening/Autonomy/Singularity gate; unlock tables and costs live in `src/data/technologies.ts`.
- `src/game/vision/VisionSystem.ts` owns the low-frequency unknown/explored/visible grid; `WorldScene` only renders its texture and hides presentation objects.
- `src/audio/AudioManager.ts` owns bounded procedural cues, gesture unlock, persistent mute/volume, and safe no-audio fallback.
- `src/game/systems/GatheringSystem.ts`, `ConstructionSystem.ts`, `AutomationSystem.ts`, `ProductionSystem.ts`, `CombatSystem.ts`, and `TurretSystem.ts` advance only from fixed simulation delta time.
- `src/game/economy/CapacityProviders.ts` applies and removes completed-building capacity without coupling it to rendering or destruction effects.
- `src/game/scenarios/economy.ts` is the shipping opening scenario; `battle.ts` holds the mirrored Day 4 debug armies (`?scenario=battle`); `day1.ts` remains the 30-unit navigation fixture. Build units only through `createUnitEntity`/`createWorkerEntity`, never entity literals.
- `src/game/world/createMatch.ts` is the seeded match entrypoint; `WorldScene.ts` is presentation only. `src/game/world/map.ts` owns the 240 x 176 playfield, start positions, and handcrafted terrain.
- `src/game/navigation/occupancy.ts` owns building navigation occupancy for every caller.
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
- The AI never writes entity, ledger, or capacity state. Every AI action goes through `AICommands`; if the AI needs a new ability, add a command that a human could also issue.
- AI planning runs at `AI.decisionsPerSecond`, never per frame, and `AIStrategy` must stay a pure function of its snapshot so seeds stay reproducible.
- All opponent balance belongs in `src/data/ai.ts`. `src/game/ai/opponentGate.test.ts` asserts the shipped seeds, so tuning changes must be re-measured.
- The AI may assume resource locations but must observe the player Core before targeting it.
- Generation unlocks must go through `TechnologySystem.canBuild` / `canProduce`; hiding a UI button is never sufficient enforcement.
- Data uses the same finite-node, cargo, ledger, deposit, and automation path as Matter and Energy.
- Player entity visibility and selection must agree with `VisionSystem`; own entities stay visible and explored terrain never returns to unknown.
- A Turret is a stationary building combatant. It acquires through the spatial hash and applies damage only through `DamageService`, and it drops any target that leaves its range so it can never be locked onto an unreachable enemy.
- The AI's unit production must degrade gracefully: an unaffordable or unproducible preferred unit falls back to one it can build, never to producing nothing.
- Barrier Walls, Gates, Habitats, Storage Depots, and Field Outposts are normal constructed buildings. Outposts and Depots accept only allied deposits.
- `setBuildingOccupancy` is the only way a building claims or releases navigation cells. It is where a Gate's walk-through exemption and a village piece's zero clearance live, and routing every caller through it is what keeps the grid's reference counts balanced.
- Clearance is per building type. Village pieces use zero so walls sit edge to edge; `placementClearance` relaxes the gap whenever either side is a village piece.
- A rotated building stores its quarter-turn on the entity and its footprint already accounts for it. Placement, navigation, and the rendered model must all read the same `rotated` flag.
- Generation upgrades are presentation only. A structure's stats never change when the colony evolves.
- Audio is presentational and optional. No gameplay action may depend on creating or resuming an `AudioContext`.

## Day 6 controls and completion state

Select the Core to evolve from **Awakening** to **Autonomy** and then **Singularity**. Costs are shown directly on the action. Data comes from violet archives and supports both direct gathering and **Auto Data**.

Selected Workers can place Relay Nodes, Fabricators, Habitats, Storage Depots, Barrier Walls, Gates, and Field Outposts in Generation I; Zap Turrets unlock in Generation II and the Heavy Foundry in Generation III. **R** quarter-turns the pending footprint, and wall, gate, and habitat placement stays armed so a run can be clicked or dragged out in one gesture. Every structure visibly rebuilds itself at each Generation. Fabricators produce Strikers plus unlocked Rangers/Scouts; Foundries produce Titans. The top bar shows Generation and all three resources. Sound can be muted and adjusted from the top-right controls.

Epic 06 and D6-01 through D6-13 are in `REVIEW`, not `DONE`. An integration review pass on 2026-09-03 re-ran every check and fixed a turret target lock, an AI production stall, and a selection-lookup regression; the findings are recorded in `QA.md` and `PROJECT_STATUS.md`. D6-11 requires the unfamiliar-player timing pass in `QA.md`; after the user accepts the manual Day 6 checklist in `PROJECT_STATUS.md`, update task checklists and roll up the epic. No Epic 6 commit has been made yet.

## Day 5 controls and completion state

The shipping match now opens against the local AI. **F3** toggles the diagnostics overlay (FPS, entity counts, AI state and goal, AI economy, forces, intel, effect pool). All Day 4 controls are unchanged.

Epics 01 through 04 are complete. D5-01 through D5-06 are `DONE`; D5-07 is `REVIEW` until the user accepts the Day 5 opponent gate recorded in `PROJECT_STATUS.md`. Begin Epic 06 with D6-01, and treat `MatchSimulation` as the place for new simulation behavior.

## Day 4 controls and completion state

Right-click is contextual for the current selection: an enemy Agent or structure issues **Attack**, an unfinished friendly site assigns a builder, a live resource issues **Gather**, and terrain issues **Move**. Selected Strikers pursue an ordered target anywhere; idle Strikers automatically engage hostiles inside their vision. Workers defend themselves only when explicitly ordered.

Health bars appear on damaged or selected units and buildings. Destroying either Core ends the match once, freezes the simulation, and shows the Victory/Defeat screen with match statistics and **Play Again**. **Main Menu** stays disabled until D6-01.

`/?scenario=battle` starts the mirrored debug armies used by the Day 4 gate.

The user accepted the Day 4 battle gate on 2026-09-02.

## Day 3 controls and completion state

The shipping scenario starts each faction with one Core, three Workers, 25 Matter, 20 Energy, and 8 Agent Capacity. Left-click selects a Worker, building, or resource; Shift and drag-box operate on friendly Workers. Right-click terrain moves selected units. Right-click a live resource to gather, or an unfinished friendly site to reassign a selected Worker as builder.

Selected Workers expose Relay/Fabricator placement and persistent **Auto Matter** / **Auto Energy** modes. Relay placement costs 80 Matter and 20 Energy; completion adds five capacity. Fabricator placement costs 160 Matter and 80 Energy; once complete it fabricates Strikers through the visible FIFO queue. Click a construction site's cancel control for a 75% refund or a queued production row for a full refund.

Camera input remains layout-aware ZQSD on AZERTY plus arrow keys; two-finger trackpad scrolling pans and pinching zooms.

Epics 01 through 03 are complete. The user accepted Epic 03's colony gate on 2026-09-02, and its automated checks are green. D3-07 rally points were intentionally cut as optional P1 scope.
