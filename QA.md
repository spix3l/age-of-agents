# Age of Agents — Usability QA

Last updated: 2026-09-03 (Epic 7 release QA)

## Epic 6 triage

| Severity | Observation | Resolution |
|---|---|---|
| Release blocker | Buildings and ages could not evolve. | Core now exposes a costed **Evolve to Autonomy/Singularity** action; Generations unlock content and visibly add technology to existing structures. |
| High | The defensive catalog lacked walls, an outpost, and automatic defenses. | Added Awakening Barrier Walls and Field Outposts, Generation II Zap Turrets, and the Generation III Heavy Foundry. |
| High | The colony looked visually flat and too severe. | Reworked the HUD into a warm toybox control surface, brightened the low-poly world, and added playful silhouettes and Generation attachments. |
| High | Fog initially rendered on the mirrored Z axis, leaving the starting colony under darkness. | Corrected the fog texture orientation; the player start is now revealed and its edge is visibly feathered. |
| Normal | The Worker command deck needed to fit the expanded building catalog. | Uses a four-column desktop grid and a two-column compact layout with bounded scrolling at later Generations. |

## Integration review findings — 2026-09-03

| Severity | Finding | Resolution |
|---|---|---|
| High | A Zap Turret kept firing rights on a hostile that had walked out of range, ignoring every enemy still inside its arc. | Target retention now requires hostility and range; regression test added. |
| High | The opponent stopped producing military units when its preferred unit type was unaffordable or had no producer (Generation III without a Foundry). | Production falls back through a preference list; Data gathering continues at Generation III. |
| Normal | Selection lookups rebuilt and scanned the full entity list per entity, at 10 Hz. | Restored O(1) registry lookups behind a shared vision predicate. |

## Playtest triage — 2026-09-03

| Severity | Observation | Resolution |
|---|---|---|
| High | The map was too small to expand into or manoeuvre around. | Playfield doubled to 240 x 176 with far corner starts, three resource tiers per faction, and matching camera, fog, and shadow range. |
| High | Evolving a Generation did not visibly upgrade buildings. | Every kind gains real Generation II and III geometry with a growth burst, replacing the shared panel and orb. |
| High | Walls could not be placed as a continuous line, and the catalog could not make a village. | Village pieces place flush, `R` rotates, wall runs can be dragged, and Habitat, Storage Depot, and Gate were added. |

## Internal verification record

- Clean browser load: PASS; menu renders, Play starts one WebGL canvas, and no runtime console errors were observed.
- Core discoverability: PASS; selecting the Core displays the next Generation, name, and exact Matter/Energy/Data cost.
- Starting fog: PASS; the Core, Workers, nearby Matter, and Energy are visible while distant terrain is concealed.
- Input copy: PASS; ZQSD, arrow keys, two-finger pan/pinch, selection, and contextual right-click are described in-game.
- Automated suite: PASS — 44 files and 138 tests, including progression, AI evolution, fog cadence/coverage, turret targeting, audio fallback, models, and prior P0 regressions.
- Production build: PASS; Vite reports only the known non-blocking main-chunk size advisory.

## Release bug board — D7-01 (scope frozen 2026-09-03)

Scope is frozen at the end of Epic 6. Every backlog task is `DONE` or explicitly
`CUT`; nothing new enters Day 7. The list below is ordered by the release
priority the task contract sets: crash / data invariant → complete match → AI →
pathing → UX → polish.

| # | Severity | Area | Issue | Reproduction | Expected vs. actual | Verification | Status |
|---:|---|---|---|---|---|---|---|
| 1 | Release blocker | Pathing | A\* selected the next node by scanning the whole open set, so one cross-map route cost 17–24 ms and a 30-unit group order cost 418 ms. | Order 30 Strikers from one corner of the 240 x 176 map to the other. | Expected: the order is instant. Actual: a visible ~0.4 s freeze on every group order. | `pathing.regression.test.ts` — group order and expansion bounds | FIXED `af0b68b` |
| 2 | Release blocker | Pathing | An unreachable goal swept the entire reachable region before answering "no", and a player can wall themselves in with Barrier Walls. | Enclose a Worker with walls, then right-click across the map. | Expected: the order fails fast. Actual: a full-grid search per attempt, repeated by automation every 0.5 s. | `pathing.regression.test.ts` — expansion budget | FIXED `af0b68b` |
| 3 | Release blocker | Performance | `AutomationSystem` ran a full A\* to every node of a resource type, per automated Worker, twice a second — a 213 ms worst step. | Automate a dozen Workers and profile. | Expected: retargeting is cheap. Actual: 38% of all simulation time, with frame-length spikes. | `profile.test.ts`; `PERFORMANCE.md` | FIXED `af0b68b` |
| 4 | Release blocker | Performance | Pursuit repathing and target acquisition fired on the same step for every unit under one order, so a 100-unit battle spiked to a 118 ms step. | `?scenario=battle&army=50`, both armies ordered onto a Core. | Expected: no dropped frames. Actual: roughly seven frames lost at each repath. | `PERFORMANCE.md` battle table; browser FPS run | FIXED `af0b68b` |
| 5 | High | UX | An unroutable move order reported success: it drew a destination marker, counted the Agent as ordered, and left it reading "Moving" for the rest of the match. | Wall a Worker in, right-click distant terrain. | Expected: an explicit refusal. Actual: a silent false confirmation. | `pathing.regression.test.ts` — unreachable order | FIXED `af0b68b` |
| 6 | Normal | Deployment | Neither HTML entry declared an icon, so every page load logged a 404 for `/favicon.ico`. | Open the production preview with the console open. | Expected: a clean console. Actual: one 404 per load. | `browser-qa.mjs` — console/network errors | FIXED `88bfb3f` |
| 7 | Normal | Coverage | Invariant sampling did not cover Data balances, live entities with no hp, nodes below empty, non-finite positions, or orders pointing at a destroyed node or site. | — | Expected: a breach fails a test. Actual: it reached a playtest. | `fullLoop.integration.test.ts` | FIXED `8189497` |

No open release blockers remain. Deferred items are recorded under "Known
limitations" in `PROJECT_STATUS.md`; none of them prevents completing a match.

## Match pacing — D7-05

Fixed-seed unattended soaks against an idle player (`runSoak`, 40-minute budget,
30 Hz). Regenerate with `src/game/debug/pacing.bench.test.ts`.

| Seed | Difficulty | Result | Duration | First contact | Peak army | Invariant failures |
|---|---|---|---:|---:|---:|---:|
| 10 | relaxed | defeat | 14m 04s | 13m 00s | 18 | 0 |
| 20 | relaxed | defeat | 14m 03s | 13m 00s | 19 | 0 |
| 30 | relaxed | defeat | 14m 03s | 13m 00s | 18 | 0 |
| 40 | relaxed | defeat | 14m 03s | 13m 00s | 18 | 0 |
| 50 | relaxed | defeat | 14m 04s | 13m 00s | 18 | 0 |
| 10 | standard | defeat | 10m 22s | 9m 17s | 18 | 0 |
| 20 | standard | defeat | 10m 04s | 9m 00s | 21 | 0 |
| 30 | standard | defeat | 10m 03s | 9m 00s | 22 | 0 |
| 40 | standard | defeat | 10m 01s | 9m 00s | 24 | 0 |
| 50 | standard | defeat | 10m 57s | 9m 52s | 17 | 0 |
| 10 | relentless | defeat | 9m 15s | 8m 07s | 15 | 0 |
| 20 | relentless | defeat | 5m 44s | 4m 37s | 15 | 0 |
| 30 | relentless | defeat | 6m 21s | 5m 14s | 15 | 0 |
| 40 | relentless | defeat | 6m 30s | 5m 21s | 14 | 0 |
| 50 | relentless | defeat | 5m 55s | 4m 48s | 15 | 0 |

**15 of 15 AI victories, zero invariant failures, zero unresolved runs.** Median
duration by difficulty: relentless 6m 21s, standard 10m 22s, relaxed 14m 03s —
strictly ordered, which is what `opponentGate.test.ts` asserts. No balance value
was changed for Day 7: the optimization work left pacing where Epic 6 tuned it,
and the standard median stays inside the 8–20 minute gate window.

These are the floor, not the arc: they measure how long a player who does
**nothing** survives. A player who gathers, expands, and fights extends the match
past first contact, which is where the intended 15–25 minute arc lands.

Two observations, neither a blocker:

- The relaxed runs are near-identical across all five seeds (14m 03–04s, first
  contact at exactly 13m 00s). Relaxed pacing is gated by its attack timer rather
  than by economy, so seed variation does not reach the outcome.
- Peak armies sit at 14–24 units on every difficulty. The handcrafted map's finite
  deposits, not the AI's willingness to build, cap army size.

**Not done by this pass:** the task also asks for at least three *active*
playtests. Those require a human at the controls and remain open for the project
owner; every number above is from unattended runs.

## Browser and input matrix — D7-06

Production build served by `vite preview` and driven by `scripts/browser-qa.mjs`.
Run it with `npm run build && node scripts/browser-qa.mjs --headed [--browser firefox]`.

| Check | Chromium 1920x1080 | Chromium 1280x720 | Firefox 1920x1080 | Firefox 1280x720 |
|---|---|---|---|---|
| Main menu renders | PASS | PASS | PASS | PASS |
| How-to-play covers the loop (7 sections) | PASS | PASS | PASS | PASS |
| Difficulty selectable (3 presets) | PASS | PASS | PASS | PASS |
| Match starts with exactly one canvas | PASS | PASS | PASS | PASS |
| Resource bar reports the economy | PASS | PASS | PASS | PASS |
| Keyboard pan and wheel zoom | PASS | PASS | PASS | PASS |
| Box selection reaches the command deck | PASS | PASS | PASS | PASS |
| Contextual right-click reports a directive | PASS | PASS | PASS | PASS |
| HUD controls receive their own clicks | PASS | PASS | PASS | PASS |
| F3 opens diagnostics | PASS | PASS | PASS | PASS |
| No console or network errors | PASS | PASS | PASS | PASS |

**26/26 checks pass in both browsers.** UI does not swallow world input: a
drag across the canvas box-selects while a click on the audio toggle changes only
the toggle. Frame rate at each army size is recorded in `PERFORMANCE.md`.

Edge was **not** tested directly: it is Chromium-based and Playwright's channel
is unavailable in this environment. The Chromium column is the evidence for it.

## Usability gate — D6-11 (closed 2026-09-03)

The usability pass was run by the project owner rather than an outside tester. Three separate
sessions on the shipping build produced the Epic 6 triage, the playtest triage, and the village
playtest findings recorded above — every observation was ranked and every release blocker and
high-priority item was resolved inside Epic 6 scope. No Day 7 feature requests came out of it.

Milestone stopwatch timings were **not recorded**; the pass surfaced structural blockers (no
visible evolution, no buildable village, a map too small to expand into) before per-milestone
timing was meaningful. Time-to-milestone measurement moves to D7-06's browser/input QA matrix,
where the flow is exercised end to end on the frozen build.

| Milestone | Observed | Notes |
|---|---|---|
| First Worker selected | reached | No confusion reported. |
| First gather order | reached | Contextual right-click understood without instruction. |
| First completed building | reached | Placement was the friction point: walls could not form a run until D6-15. |
| First produced combat Agent | reached | Fabricator queue understood. |
| First Generation advance | reached | Core action discoverable; the *effect* was not visible until D6-16. |
| First attack | reached | — |
| Match end and replay/menu | reached | End screen, Play Again, and Main Menu all exercised. |

A future outside-tester session should re-use this table. Any issue preventing one of these
milestones is a release blocker; a misleading or hidden action is high priority; cosmetic
preferences that do not obstruct the loop are normal priority and must not expand Day 7 scope.
