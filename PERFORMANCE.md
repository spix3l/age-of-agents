# Age of Agents — Performance

Last measured: 2026-09-03, commit `8189497`.

## Baseline hardware

| | |
|---|---|
| Machine | Apple M3, macOS 26.6.2 |
| Runtime | Node 24.18.1, Vite 8.2.2, three 0.185.1 |
| Browsers | Chromium 151 and Firefox (Playwright), GPU compositing enabled |
| Simulation | fixed 30 Hz step, `MatchSimulation.step(1/30)` |
| Playfield | 240 x 176, a 42,240-cell navigation grid |

Two harnesses produce every number below, and both are checked in:

```sh
# Phase-level simulation cost, headless. Unskip the describe block first.
npx vitest run src/game/debug/profile.test.ts --reporter=verbose

# Real browser frame rate on the production build.
npm run build && node scripts/browser-qa.mjs --headed
```

`profileMatch` wraps each system on the instance rather than instrumenting
`MatchSimulation.step`, so the shipped simulation carries no profiling branch.
Frame rate must be measured `--headed`: headless Chromium renders WebGL through
SwiftShader and reports ~1 FPS no matter what the page does.

## What the profile found

A full seed-10 match spent **94% of its time inside A\***, in two places.

- `AStar` chose the next node by scanning the entire open set, so a search cost
  O(V²). One cross-map route took 17–24 ms — longer than a 60 FPS frame — and a
  single 30-unit group order took **418 ms**. Every search also allocated a
  fresh `Int32Array` + `Float64Array` over the whole grid, about half a megabyte
  of garbage per call, thousands of times a minute.
- `AutomationSystem` ran a full A\* to *every* node of a resource type, for every
  automated Worker, twice a second.

Both are fixed: a binary-heap open set over reused, generation-stamped scratch
buffers, and a straight-line prefilter that path-verifies only the nearest three
candidates. Pursuit repathing and target acquisition were also firing on the same
step for every unit under one order, so a large army paid its whole repath bill
in a single step; both cadences are now jittered by a deterministic per-entity
phase, leaving the mean interval unchanged.

## Simulation — full AI match (seed 10)

| | Before | After |
|---|---:|---:|
| Wall time for the match | 6.49 s | 0.61 s |
| Speed vs. real time | 93x | 1017x |
| Worst `combat` step | 133.2 ms | 4.9 ms |
| Worst `automation` step | 213.8 ms | 2.4 ms |
| `combat` total | 3570 ms | 411 ms |
| `automation` total | 2483 ms | 20 ms |
| Full test suite | 73 s | 7 s |

## Simulation — battle scale

`?scenario=battle&army=N`, both armies ordered onto the opposing Core, so every
unit is pursuing, repathing, acquiring, and shooting at once.

| Units | Worst step before | Worst step after | Total before | Total after |
|---:|---:|---:|---:|---:|
| 30 | 14.8 ms | 1.5 ms | 368 ms | 92 ms |
| 60 | 33.1 ms | 2.2 ms | 752 ms | 193 ms |
| 100 | 118.3 ms | 3.0 ms | 1508 ms | 342 ms |

A 118 ms step is roughly seven dropped frames. The 100-unit case is now 0.3 ms
per step on average and never exceeds a single frame budget.

## Browser frame rate

Production build served by `vite preview`, 1920x1080, measured over 6 seconds
with `requestAnimationFrame` after the scene settles.

| Scenario | Chromium avg FPS | Firefox avg FPS | Chromium p95 frame |
|---|---:|---:|---:|
| Opening colony | 60 | 50 | 17.5 ms |
| 30-unit battle | 59 | 55 | 17.5 ms |
| 60-unit battle | 59 | 52 | 17.5 ms |
| 100-unit battle | 56 | 50 | 33.3 ms |

Both targets are met: 60 FPS in normal play and well above 30 FPS in a 100-unit
battle.

## Allocation and cleanup

- Path searches allocate nothing per call. Scratch buffers are keyed by grid
  size and reused; a `stamp` array records which search last wrote a cell, so
  nothing is cleared between runs.
- `SpatialHash` keeps one bucket membership per entity and is re-synced once per
  step, never per query.
- `EffectsManager` pools shot, impact, and collapse meshes under a hard ceiling
  (`COMBAT.maxActiveEffects`) and drops overflow rather than allocating.
- React receives throttled 10 Hz snapshots. No per-frame entity state reaches a
  React component, and simulation code cannot import React.
- Every browser listener, animation frame, Three.js resource, and observer is
  disposed on remount; Play Again remounts `Game` through the store's match
  nonce and the canvas count stays at one.

## Remaining bottleneck

`combat` is now the largest simulation phase at roughly 65% of step time, and
almost all of that is still pursuit repathing. The next lever, if one is ever
needed, is a shared flow field for units converging on the same target rather
than an independent A\* each — measured need first; nothing currently misses a
frame budget.

The production JavaScript chunk stays above Vite's advisory 500 kB because of
three.js. It is a single cached download of a static asset with no runtime cost,
and code-splitting it was judged not worth the complexity for this build.
