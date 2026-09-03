# Age of Agents — Usability QA

Last updated: 2026-09-03

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
