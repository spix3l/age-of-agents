# Age of Agents

A browser real-time strategy game about a colony of machines. Wake a Core, mine a
dead world with Worker Agents, evolve through three Generations, and out-build a
rival intelligence before it destroys you.

Everything renders as procedural low-poly geometry and every sound is synthesized
at runtime. There is no backend, no asset pipeline at load time, and no network
dependency: the shipped build is a folder of static files.

## Run it

```sh
npm install       # or npm ci, to install exactly the lockfile
npm run dev       # development server, prints its URL
```

Then open the printed URL and press **PLAY**.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run typecheck` | `tsc -b`, the whole project |
| `npm run lint` | ESLint over every source file |
| `npm test -- --run` | Vitest, the full suite once |
| `npm run build` | Type-check, then the production bundle into `dist/` |
| `npm run preview` | Serve `dist/` exactly as it will be deployed |

## How to play

Press **HOW TO PLAY** on the main menu for the in-game version. In short:

- **Select** with left-click; drag a box for several Agents; Shift adds.
- **Right-click is contextual.** Terrain moves, a resource gathers, an unfinished
  friendly site assigns a builder, an enemy attacks.
- **Gather** Matter (gold), Energy (cyan), and Data (violet). `AUTO MATTER` /
  `AUTO ENERGY` / `AUTO DATA` keep a Worker looping forever.
- **Build** with a Worker selected. `R` quarter-turns the pending footprint;
  walls, gates, and habitats stay armed so a run can be dragged out in one gesture.
- **Evolve** by selecting the Core: Awakening → Autonomy → Singularity. Each
  Generation unlocks new Agents and structures and visibly rebuilds the colony.
- **Win** by destroying the enemy Core before it destroys yours — or pick
  **Freestyle** on the menu, which lays the same map down with no opponent, no
  clock, and nothing that can end the match.
- **Camera**: ZQSD or arrow keys pan, two-finger scroll pans, pinch zooms.
- **P** pauses; **Esc** resumes. The pause overlay is where **SAVE GAME** lives,
  and **CONTINUE** on the main menu resumes the saved match. There is one slot,
  it is kept in the browser, and finishing a match clears it.
- **F3** opens the diagnostics overlay (FPS, entity counts, AI state, effect pool).

### URL parameters

| Parameter | Effect |
|---|---|
| `?scenario=battle` | Two mirrored debug armies instead of the normal opening |
| `?scenario=showcase` | Every building and Agent laid out for art review |
| `?army=N` | Strikers per side in the battle scenario (1–100) |
| `?post=off` | Disables post-processing |

## Architecture

The rule that shapes everything: **`MatchSimulation` is the authoritative match,
and it contains no Three.js, no DOM, and no React.** The rendered game and the
headless soak harness advance identical code, which is why AI behaviour can be
tested without a browser.

```
src/
  game/
    match/MatchSimulation.ts   the authoritative match: entities, economies,
                               every fixed-step system, destruction, match end
    Game.ts                    presentation shell: renderer, camera, input,
                               selection, placement, HUD wiring. Kept thin.
    commands/                  the player/AI boundary — move, gather, automate,
                               attack, build. Both sides issue the same commands.
    systems/                   fixed-step systems: movement, gathering,
                               automation, construction, production, technology,
                               combat, turrets
    ai/                        the opponent: 3 Hz controller, pure utility
                               strategy, read-only context, economy/build/military
    navigation/                grid, A*, occupancy
    combat/                    hostility, DamageService, destruction, stats
    vision/                    the fog-of-war grid
    rendering/                 procedural models, effects pool, renderer
    debug/                     logger, runSoak, profileMatch
  ui/                          React HUD, menus, store (10 Hz snapshots)
  data/                        every balance constant, and nothing else
  audio/                       procedural Web Audio cues
```

`AGENT_HANDOFF.md` is the full map, including the invariants any change must
preserve. Read it before editing.

### Command flow

A player click and an AI decision travel the same path:

```
input / AI strategy
      ↓
commands/*.ts        validate, then mutate through the one sanctioned path
      ↓
MatchSimulation      fixed-step systems advance state
      ↓
hooks                presentation is notified; effects are never load-bearing
      ↓
ui/store.ts          throttled 10 Hz snapshot
      ↓
React HUD
```

The AI never writes entity, ledger, or capacity state. If it needs a new ability,
that ability becomes a command a human could also issue.

## Testing and measurement

```sh
npm test -- --run                                  # 156 tests, ~7s

# Simulation phase costs (unskip the describe block first)
npx vitest run src/game/debug/profile.test.ts --reporter=verbose

# Match pacing table across every seed and difficulty
npx vitest run src/game/debug/pacing.bench.test.ts --reporter=verbose

# Drive the production build in a real browser
npm run build && node scripts/browser-qa.mjs --headed [--browser firefox] [--full]
```

`scripts/browser-qa.mjs` checks the menu, camera, selection, contextual orders,
placement, HUD-vs-world input isolation, diagnostics, console/network errors, and
frame rate at 30/60/100 units. `--headed` is required for meaningful FPS:
headless Chromium renders WebGL through SwiftShader and reports ~1 FPS.

Randomness comes only from `src/game/util/Random.ts`, seeded — never `Math.random`
— so every soak and gate is reproducible.

## Deployment

The build output is static. There is no server runtime, API, authentication, or
WebSocket anywhere in the project; the only persistent storage is `localStorage`
for the audio mute and volume, and it degrades silently when unavailable.

**Cloudflare Pages**

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 20 or newer |
| Environment variables | none required |

Serving from a sub-path instead of a domain root: build with `BASE_PATH`, which
is baked into the asset URLs.

```sh
BASE_PATH=/game/ npm run build
```

Any static host works the same way — copy `dist/` and serve it.

## Supported browsers

Chromium (Chrome, Edge) and Firefox on desktop, at 1280x720 and above, with
WebGL2 and GPU compositing. Verified against the production build; the matrix is
in `QA.md` and frame rates are in `PERFORMANCE.md`. Mobile and touch-only devices
are out of scope for V1.

## Known limitations

- Worker repair of damaged friendly buildings is described in the PRD but was not
  built.
- Rally points were cut as optional post-P0 scope; produced Agents are
  immediately controllable through the normal movement command.
- The opponent builds Relays, Habitats, Fabricators, Depots, Turrets, Foundries,
  and a short run of walls, but never Gates or Field Outposts.
- Fog of war is not saved: a resumed match re-explores the map it had already seen.
- Peak armies are capped near 20 units by the handcrafted map's finite deposits,
  not by either side's willingness to build.
- The main JavaScript chunk stays above Vite's advisory 500 kB because of
  three.js. It is one cached static download with no runtime cost.
- The D7-05 active playtests and any outside-tester usability session remain open
  for a human; every recorded run is unattended.

## Project documents

| File | What it holds |
|---|---|
| `PRD.md` | The product definition and Definition of Done |
| `BACKLOG.md` + `backlog/` | Epics and task contracts; task files are authoritative |
| `PROJECT_STATUS.md` | Current state, shipped decisions, verification record |
| `AGENT_HANDOFF.md` | Architecture map and the invariants to preserve |
| `QA.md` | Triage, release bug board, pacing runs, browser matrix |
| `PERFORMANCE.md` | Profiling baseline, optimizations, frame rates |
| `art/README.md` | The reference-art → procedural-model pipeline |
