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

## Internal verification record

- Clean browser load: PASS; menu renders, Play starts one WebGL canvas, and no runtime console errors were observed.
- Core discoverability: PASS; selecting the Core displays the next Generation, name, and exact Matter/Energy/Data cost.
- Starting fog: PASS; the Core, Workers, nearby Matter, and Energy are visible while distant terrain is concealed.
- Input copy: PASS; ZQSD, arrow keys, two-finger pan/pinch, selection, and contextual right-click are described in-game.
- Automated suite: PASS — 43 files and 130 tests, including progression, AI evolution, fog cadence/coverage, turret targeting, audio fallback, models, and prior P0 regressions.
- Production build: PASS; Vite reports only the known non-blocking main-chunk size advisory.

## External tester gate

D6-11 remains `REVIEW`. A tester unfamiliar with the implementation should complete one match and record:

| Milestone | Time | Confusion / failure |
|---|---:|---|
| First Worker selected | — | — |
| First gather order | — | — |
| First completed building | — | — |
| First produced combat Agent | — | — |
| First Generation advance | — | — |
| First attack | — | — |
| Match end and replay/menu | — | — |

Any issue preventing one of those milestones is a release blocker. A misleading or hidden action is high priority. Cosmetic preferences that do not obstruct the loop are normal priority and should not expand Day 7 scope.
