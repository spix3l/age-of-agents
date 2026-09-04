# Agent Handoff

Read `README.md` first for how to run and deploy the project. Read `PRD.md`, `BACKLOG.md`, and `PROJECT_STATUS.md` before changing code, and `PERFORMANCE.md` before touching anything in a hot loop. Task files under `backlog/tasks/` are the authoritative work contracts.

## Run the project

```sh
npm install
npm run dev
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm run preview

# Browser gate. --headed is required for meaningful FPS; --full adds an unattended
# match through the end screen, Main Menu, and a clean replay.
npm run build && node scripts/browser-qa.mjs --headed [--browser firefox] [--full]
```

## Architecture map

- `src/game/match/MatchSimulation.ts` is the authoritative match: entities, economies, every fixed-step system, destruction, and match end, with no Three.js, DOM, or React. Add simulation behavior here.
- `src/game/Game.ts` is the presentation shell: renderer, camera, input, selection, placement, and HUD wiring around one `MatchSimulation`. Keep it thin and keep simulation logic out of it.
- `src/game/ai/` is the opponent: `AIController` (3 Hz tick, memory, slices), `AIStrategy` (pure utility scoring), `AIContext` (read-only view + command adapter), `EconomyAI`, `BuildPlanner`, `MilitaryAI`, `AIKnowledge`.
- `src/game/debug/` holds the category `Logger` and `runSoak`, the deterministic unattended match report used by the Day 5 gate.
- `src/game/navigation/AStar.ts` is a binary-heap A* over reused, generation-stamped scratch buffers with a hard `MAX_EXPANSIONS` budget. It allocates nothing per search. `pathMetrics` counts searches and expansions for the profiler.
- `src/game/util/phase.ts` gives a stable per-entity fraction. Use it to spread throttled per-entity work across an interval instead of firing it on the same step for every unit.
- `src/game/debug/profileMatch.ts` times each simulation phase by wrapping systems on the instance; `profile.test.ts` and `pacing.bench.test.ts` are skipped harnesses that regenerate the tables in `PERFORMANCE.md` and `QA.md`.
- `scripts/browser-qa.mjs` drives the production build in Chromium or Firefox: UX matrix, console/network errors, frame rate, and the full match lifecycle.
- `src/game/util/Random.ts` is the only sanctioned source of randomness; seed it, never call `Math.random`.
- `src/game/building/PlacementController.ts` owns snapped placement state and authoritative validation. `Game.ts` confirms placement by spending, creating the site, blocking its footprint, and assigning a builder as one rollback-safe transaction. The same tool is reused for relocation: `Game.relocating` swaps its validate and confirm callbacks so the ghost, snapping, `R`, and cancel behave identically.
- `src/game/GameState.ts` owns separate unit, building, and resource registries plus faction economies.
- `src/game/economy/` owns atomic ledgers and used/reserved/max Agent Capacity. Extend these instead of storing balances on UI objects.
- `src/game/entities/resources/` owns finite resource-node state; `src/game/entities/buildings/Core.ts` owns the first building contract.
- `src/game/commands/GatherCommand.ts`, `MoveCommand.ts`, `AutomateCommand.ts`, `AttackCommand.ts`, `BuildCommand.ts`, and `RelocateCommand.ts` are player/AI-safe command boundaries. `RelocateCommand` is the only way a placed structure changes position: it lifts the building off the navigation grid for the validity check so it never blocks its own destination, then either re-seats it or restores it untouched.
- `src/game/combat/` owns hostility rules, `DamageService` (the only HP writer), the shared `destruction.ts` cleanup, and `MatchStats` attribution.
- `src/game/systems/MovementSystem.ts` is the only enforcement of the navigation grid at runtime. A* plans a correct route, but a route is walked for seconds afterwards, so every step is re-tested: a step from open ground into a blocked cell is refused and rerouted, and a step *out of* a blocked cell is always allowed so a unit built around can leave. Never move a unit by writing `position` directly from another system.
- `breachTarget` in `src/game/commands/AttackCommand.ts` is what stops a sealed colony from being an exploit: an attacker with no route to its target switches to the structure in the way. Both `issueAttackCommand` and `CombatSystem`'s pursuit-failure branch go through it.
- `src/game/spatial/SpatialHash.ts` backs all nearby-target queries. Re-sync it once per simulation step; never scan every entity.
- `src/game/match/MatchState.ts` owns the single Victory/Defeat transition.
- `src/game/save/SaveGame.ts` is the save format and the only place a match is written down or read back: `captureSave` describes the world, `savedScenario` rebuilds it as a fixture, `MatchSimulation.restoreState` applies the match-wide rest, and `parseSave` distrusts everything that comes out of storage. Orders, paths, vision, and the opponent's plan are deliberately not saved — add derived state to a system, never to the save. `saveStorage.ts` owns the single local slot.
- Game modes live in one place: `GameMode` in `src/game/save/SaveGame.ts`, chosen on the menu, held in `src/ui/store.ts`, and passed to `Game`. Freestyle is `solo: true` through `createMatch` plus `opponent: false`; it is not a separate scenario.
- Pause is store state (`useUiStore.paused`). `Game` subscribes to it and hands it to `GameLoop`; nothing else acts on it, and the overlay in `src/ui/menus/PauseMenu.tsx` is what stops input reaching a held match.
- `src/game/rendering/EffectsManager.ts` pools all combat visuals and is driven only by presentation hooks.
- `src/game/rendering/Renderer.ts` owns adaptive quality: `nextQuality` is the pure hysteresis rule (down fast, up slow) and `setQuality` scales device pixel ratio, bloom, and — through `WorldScene.setShadowQuality` — shadow resolution. `?quality=` pins a tier and `?seed=` pins a match, which is how a machine-specific or map-specific report is reproduced. Draw calls, triangles, megapixels, and the tier are on the F3 overlay; measure there before optimizing anything.
- Structure models bake their static meshes into one mesh per material (`mergeStatic`), cached per kind and team. Anything the renderer animates -- spinners, the emissive column, the working arm, Generation tiers -- must stay out of the bake, so new animated parts belong in `BuildingModel`, never loose in the group.
- `src/game/systems/TechnologySystem.ts` is the authoritative Awakening/Autonomy/Singularity gate; unlock tables and costs live in `src/data/technologies.ts`.
- `src/game/systems/SynthesisSystem.ts` manufactures resources for crewed plants (Reclamation Plant, Cognition Lab); recipes live in `src/data/synthesis.ts`. Deposits are finite and never regrow — synthesis is the floor under a stripped map, deliberately priced as a loss. Cycle progress is derived state held in the system, never on the entity and never in the save.
- `src/game/systems/nodeSearch.ts` is the shared "nearest node a Worker can actually reach" search, used by `AutomationSystem` (whole map) and by `GatheringSystem`'s depletion retarget (`RETARGET_RANGE`, local, measured from the drop point -- Workers must never scout). Only the closest few candidates are path-verified; never path to every node of a type.
- `src/game/vision/VisionSystem.ts` owns the low-frequency unknown/explored/visible grid; `WorldScene` only renders its texture and hides presentation objects.
- `src/audio/AudioManager.ts` owns bounded procedural cues, gesture unlock, persistent mute/volume, and safe no-audio fallback.
- `src/game/systems/GatheringSystem.ts`, `ConstructionSystem.ts`, `AutomationSystem.ts`, `ProductionSystem.ts`, `CombatSystem.ts`, and `TurretSystem.ts` advance only from fixed simulation delta time.
- `src/game/economy/CapacityProviders.ts` applies and removes completed-building capacity without coupling it to rendering or destruction effects.
- `src/game/scenarios/economy.ts` is the shipping opening scenario; `battle.ts` holds the mirrored Day 4 debug armies (`?scenario=battle`); `day1.ts` remains the 30-unit navigation fixture. Build units only through `createUnitEntity`/`createWorkerEntity`, never entity literals.
- `src/game/world/createMatch.ts` is the seeded match entrypoint; `WorldScene.ts` is presentation only. `src/game/world/map.ts` owns the 300 x 224 playfield, the scenery margin beyond it (`MAP_MARGIN`, shared by the terrain, the forest, and the fog overlay), start positions, and handcrafted terrain. `src/game/world/environment.ts` builds all scenery once (rolling terrain beyond the bounds, stratified mesas over the navigation obstacles, instanced forests, ground cover, ponds); it never touches simulation state.
- `src/game/camera/RTSCameraController.ts` is a perspective camera pitched 60° looking down -Z; zoom moves the camera distance, `zoomLevel` is relative magnification for the shadow frustum.
- `src/game/rendering/models/` holds the procedural art. `palette.ts` defines the dark gunmetal + faction glow language (cyan vs orange) and the shared `ResourceCache`; `buildings.ts` assembles structures from a small `Kit` (octagonal drums, bevelled slabs, light strips, warning lamps); `units.ts` builds chibi mechs in light armour. `?scenario=showcase` (`src/game/scenarios/showcase.ts`) spawns every structure and Agent kind for art review.
- `art/` is the reference-art pipeline (sheet → per-model crops → `src/game/rendering/models/generated/`), documented in `art/README.md`. `src/showcase/` plus `model-lab.html` is the standalone Model Lab build entry that reviews a generated factory beside the crop it came from; it is separate from the game entry and the match still renders the hand-written models. `scripts/` holds the generator/capture CLIs; their bulk outputs (`models/`, `models3d/`) are gitignored scratch.
- `src/game/navigation/occupancy.ts` owns building navigation occupancy for every caller.
- `src/game/input/InputManager.ts` is the only raw pointer-event adapter. Right-click is contextual in `Game.ts`.
- `src/ui/store.ts` exposes throttled HUD snapshots and command callbacks; never publish per-frame transforms there.
- `src/data/` is the only home for gameplay balance constants. Costs are deliberately spread across all three resources: a colony that only ever spends Matter banks Energy and Data it can never use, and `AI.energyWorkerRatio` is derived from that cost mix and the relative gather rates -- change one and re-derive the other.

## Important invariants

- Every entity has a stable validated ID; labels are never identity.
- Simulation uses `{ x, z }`; Three.js maps this onto its XZ ground plane.
- Only a faction's deposit-capable structures accept that faction's cargo.
- Spending is atomic. Costs are charged and capacity reserved at enqueue, then reservation is committed only on successful spawn.
- A destroyed provider lowers maximum capacity without deleting already-used slots. Unit destruction callers must release used capacity.
- Gather orders survive normal repathing, and survive the node they were aimed at: an exhausted deposit re-aims the order at the nearest live one of the same type near the Worker's deposit structure, or releases it. A manual move explicitly cancels gathering.
- A structure either provides Agent Capacity or occupies it, never both, and `capacityApplied` gates the pair so its effect is applied and removed exactly once.
- Buildings update navigation occupancy through `NavigationGrid`; its reference counts must remain balanced.
- A construction site is non-operational until complete. Cancelling one unblocks its footprint, clears its builder order, and refunds 75%.
- Automation persists through normal gather/deposit cycles; explicit move, gather, or build orders cancel the automation mode.
- Core and Fabricator production share one FIFO queue. Costs and capacity are reserved on enqueue; user cancellation refunds both in full.
- Selection may include player units/buildings and neutral resources, never enemy entities.
- React receives UI snapshots at 10 Hz. Simulation code cannot import React.
- New browser listeners, animation frames, Three.js resources, and observers must be disposed on remount.
- Human and future AI actions should converge on the same command/system boundaries.
- A path search must stay bounded. `MAX_EXPANSIONS` is what stops an unreachable goal — a Worker walled into its own colony, an order clicked onto an island — from sweeping a 42,240-cell grid, repeatedly, at automation cadence.
- Throttled per-entity work must be phase-spread with `entityPhase`, never scheduled on a shared step. Setting a cooldown to a constant makes a whole army pay its bill in one step.
- A command that produced no effect is a refusal and must be reported as one. Never count an unroutable order as issued, and never set an activity the simulation did not actually start. A refusal must also say what would fix it: name the resource that is short, not just "insufficient resources", and state affordability on the button before the tool is armed.
- The Core is the match. It has to survive long enough for a player to notice, look, and answer -- measured, not asserted: `first damage -> defeat` on a passive colony is the number that matters, and the attack alarm plus Space-to-look is what makes that time usable.
- Performance regressions are guarded by deterministic counters (cell expansions, search counts), not wall clock. Millisecond thresholds are flaky under parallel-suite load.
- `checkInvariants` in `src/game/debug/soak.ts` is the shared invariant set. Extend it there so `runSoak` and the integration suites both gain the check.
- The build must stay a static bundle: no backend, API, authentication, WebSocket, or secret. `localStorage` is optional and every access is guarded.
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

Epics 01 through 07 are `DONE`; the Day 7 ship gate passed. Epic 06 closed on 2026-09-03 with all sixteen tasks complete, every automated check green (typecheck, lint, 44 files / 138 tests, production build), and the usability triage recorded in `QA.md`. D6-11's pass was run by the project owner rather than an outside tester; per-milestone timing carries into D7-06's QA matrix. Epic 07 — Survive and Ship is the active epic; start at D7-01 and treat the feature set as frozen.

## Day 5 controls and completion state

The shipping match now opens against the local AI. **F3** toggles the diagnostics overlay (FPS, entity counts, AI state and goal, AI economy, forces, intel, effect pool). All Day 4 controls are unchanged.

D5-01 through D5-07 are `DONE`. The Day 5 gate numbers are asserted on the shipped seeds by `src/game/ai/opponentGate.test.ts` and were re-measured after the Epic 6 map change. Treat `MatchSimulation` as the place for new simulation behavior.

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

## Day 7 release state

The seven-day build is complete. All nine P0 tasks are `DONE`; D7-05's active
playtests and D7-09's hands-on playthrough were waived by the project owner on
2026-09-04 in favour of the recorded unattended evidence.

Last verified at commit `78995f5` from a clean `npm ci`: typecheck, lint, 157
tests (three consecutive runs), production build, static preview, Chromium and
Firefox browser gates (33/33 with `--full`), and fifteen unattended pacing soaks
with zero invariant failures.

If you are picking this up: read `README.md`, then `PERFORMANCE.md` before
changing anything in a hot loop, and re-run `node scripts/browser-qa.mjs
--headed --full` before claiming the ship gate again.

Post-release work lives in Epic 08.
