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

- `src/game/Game.ts` is the composition root. Keep it thin and wire new systems through commands.
- `src/game/GameState.ts` and `src/game/entities/core/` own simulation entities and stable IDs.
- `src/game/GameLoop.ts` owns fixed-step simulation timing and render interpolation.
- `src/game/navigation/` owns grid occupancy and deterministic A*.
- `src/game/commands/MoveCommand.ts` is the player move command boundary and formation-slot allocator.
- `src/game/systems/` owns movement and selection behavior.
- `src/game/world/` and `src/game/rendering/` own Three.js presentation and map constants.
- `src/game/input/InputManager.ts` is the only raw pointer-event adapter.
- `src/ui/store.ts` exposes low-frequency UI state to React. Do not publish unit transforms there.
- `src/data/` is the only home for gameplay balance constants.

## Important invariants

- Every entity has an explicit validated ID; never use a display label as identity.
- Simulation uses `{ x, z }`; Three.js maps this onto its XZ ground plane.
- Occupancy changes must go through `NavigationGrid`; its counts allow overlapping blockers to be removed safely.
- Move orders replace existing paths. Pathfinding runs on command or bounded stuck recovery, never every frame.
- Only alive, player-team units may enter controllable selection.
- New browser listeners, animation frames, Three.js resources, and observers must be disposed on React remount.
- Gameplay actions for future AI and humans should converge on the same command layer.

## Day 1 controls and scenario

The development scenario in `src/game/scenarios/day1.ts` spawns 30 player Workers in the northwest. Left-click selects, Shift adds/toggles, left-drag box-selects, and right-click issues a terrain move. Camera input is layout-aware ZQSD on AZERTY keyboards plus arrow keys; two-finger trackpad scrolling pans and pinching zooms.

Epic 01 and its Day 1 interaction gate are complete. Start Epic 02 from D2-01 and preserve the Day 1 scenario as a development fixture.
