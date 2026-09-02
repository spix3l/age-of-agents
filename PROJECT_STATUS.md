# Age of Agents — Project Status

Last updated: 2026-09-02

## Current milestone

Epic 01 is `DONE`. The Day 1 build boots as a local-first Vite/React/Three.js application with a handcrafted battlefield, 30 selectable Worker Agents, bounded RTS camera controls, grid A* navigation, obstacle-aware group movement, and sci-fi HUD feedback.

The automated gate is green. The user accepted the rendered world and authorized completion of the interactive Day 1 gate on 2026-09-02.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test -- --run` | PASS — 8 files, 18 tests |
| `npm run build` | PASS |
| Dev server HTTP boot | PASS — `/` and transformed entry returned HTTP 200 |
| Interactive Day 1 gate | PASS — user accepted |

## Manual Day 1 gate record

Accepted by the user on 2026-09-02 against this checklist:

1. At desktop and narrow viewport sizes, the battlefield fills the window without distortion.
2. ZQSD and arrow keys pan, two-finger trackpad scrolling pans, pinch zooms, zoom remains bounded, and the view cannot leave the map.
3. Click selects one friendly Worker; empty click clears; Shift-click adds/removes a Worker.
4. Drag a box around the full starting swarm and confirm `30 WORKERS` in the HUD with visible selection rings.
5. Right-click across each stone ridge; all 30 Workers receive distinct slots, route around blockers, and settle.
6. Repeat movement commands for five minutes and confirm there are no uncaught console errors or permanently stuck Workers.

## Shipped decisions

- The first map is handcrafted and deterministic, per the seven-day scope policy.
- Simulation runs at a fixed 30 Hz; Three.js transforms synchronize only during render.
- React/Zustand owns HUD-facing snapshots only, never per-frame unit positions.
- Navigation is a one-world-unit grid with reference-counted occupancy and diagonal corner-cut prevention.
- Group destinations reserve distinct walkable cells before running A*.
- All Day 1 visuals use local procedural primitives; the build makes no asset or font network requests.
- Visual direction is a bright, sunlit low-poly diorama with warm cliffs, green terrain, dense perimeter vegetation, and sci-fi machine accents.
- The orthographic camera uses the classic isometric 35.3° elevation with equal X/Y/Z offsets, preserving strong side silhouettes instead of reading as an aerial view.
- Flat translucent ground-patch meshes were removed because their polygon edges read as rendering artifacts; terrain variation now comes from the ground's vertex colors and physical scenery.

## Known follow-ups

- Three.js keeps the main production JavaScript chunk above Vite's advisory 500 kB threshold. This is not a Day 1 blocker; profile before splitting.
- Sophisticated local avoidance is intentionally outside committed scope. Current formation slots and obstacle paths are sufficient for the Day 1 gate.
- Epic 02 should replace the 30-unit test scenario with the real one-Core/three-Worker starting state while preserving the scenario as a development fixture.
