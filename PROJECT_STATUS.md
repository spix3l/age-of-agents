# Age of Agents — Project Status

Last updated: 2026-09-04

## Three resources worth having, and a frame that fits the machine — 2026-09-04 (D8-18)

Two reports from one mid-game screenshot: 106 Matter beside 830 Energy and 253 Data, with "the map
is vast but we don't have as much resources, when building a city" and "it's already laggy".

**The economy.** Supply was never the problem — a seeded map holds about 7800 Matter per faction
and a ten-structure walled city costs about 1200. Demand was: almost everything was priced in
Matter alone, so Matter was the only wall a builder ever hit while the other two piled up unspent.
Costs are now spread across all three. Defence and production lean on Energy (a Turret is 75 Matter
and 80 Energy), the Generation III roster leans on Data, and a synthesis plant is bought mainly
with the resource it converts *from* — a Reclamation Plant is 60 Matter and 190 Energy, so a colony
that has run its Matter down can actually afford the thing that makes Matter. That trap was the
sharpest edge in the report: the way out of a Matter shortage used to cost 130 Matter.

Worker cargo went 10 → 14 in the same pass. That scales income with *distance* rather than by
making deposits richer, which is the honest answer to a vast map: enriching nodes would have made
the safe home cluster better and the contested middle pointless. Measured on the shipping map, a
Matter Worker returns about 1.5/s and an Energy Worker about 1.2/s.

The opponent's Worker split had to follow, and this time it is derived rather than guessed. A
Worker returns Matter about 1.5x faster than Energy (10 per 1.2s against 8 per 1.45s) and the
roster now spends roughly 60:40, so about half the crew belongs on Energy. Two rounds of tuning by
feel made things worse — at a quarter the opponent banked Matter it could not spend and sat at 20
Energy holding the Data for a Generation it could not buy — before the arithmetic made it right.
Assault cadence came out healthier than before the change, most gaps under 210s.

**The frame.** Two measurements, both new, because nothing was watching them: a structure cost 34
draw calls, and a 23-building colony cost 1281 — which is why a city gets slower as it is built.
Every structure is assembled from thirty-odd small pieces that never move relative to each other,
so everything except the animated parts is now baked into one mesh per material and cached per kind
and team. The same colony costs 917, and that saving compounds with every structure a player lays.

The other half is pixels. A 2000px window on a Retina panel asks for 8.0 megapixels a frame, every
one of them through a bloom pass. The renderer now scales itself from the frame rate it is actually
managing: medium is 4.5 megapixels, low is 2.0 with bloom off and half-resolution shadows. Stepping
down takes three seconds of trouble; stepping back up takes twenty-five seconds of comfort, because
a symmetric rule restores exactly the load that caused the step down and an oscillating resolution
is worse to look at than a steady lower one. The diagnostics overlay (F3) now reports draw calls,
triangles, megapixels, and the current tier, and `?quality=` pins it — a machine that never drops a
frame can still reproduce what a slower one sees. `?seed=` pins the match for the same reason.

Measured after the rebalance, with a colony that builds economy and defences and never produces a
single combat Agent: fortified, it survived the full forty minutes on two of three seeds (one
before) and held first damage off to 741s on the third. Unfortified it still loses at 749-892s.

## A survivable opening and a readable deck — 2026-09-04 (D8-17)

Four player reports from one session, in the order they landed.

**"I'm not able to place buildings, but it debited my resources."** Driven through the production
build with the same clicks: one Relay charged exactly 80 Matter and 20 Energy and started
construction, and every attempt after it left the ledger untouched at 35 Matter. Nothing leaked —
the placements were refused because *Energy* was at zero, while the number the player was watching
was Matter. The transaction is now asserted directly by a test, and the two things that actually
failed the player are fixed: a build the colony cannot pay for is dimmed and unclickable before it
is armed, with the short resource marked in its cost line, and a refusal names what is missing
("NEEDS 20 ENERGY") instead of saying "insufficient resources" at someone looking at a healthy
balance.

**The command deck.** It had become one four-column grid holding ten build buttons and three
automation buttons, clipped to two rows with the placement hint printed absolutely over the top of
them. It is now two labelled groups — BUILD, then KEEP GATHERING with the hint beside it — every
unlocked structure visible at once, costs in the resource bar's own glyphs, and a width that stops
short of the minimap instead of running under it.

**"Workers moving to collect resources on their own makes them discover the map on their own, do we
want this?"** No. The depletion retarget is a promise that a gather order outlives its rock, not a
licence to explore: an economy that quietly reveals the map, walks into a patrol, or opens a long
undefended haul is making a strategic decision that belongs to the player. The radius dropped from
40 units to 22, measured from the Worker's drop point — comfortably inside the gap between one
resource cluster and the next, so a Worker moves to the next rock in the clearing it is already
working and no further. Crossing the map stays an explicit order, or standing automation, which
searches the whole field on purpose.

**"The core dies too fast, the game isn't fair enough so you would need actual building and
strategy."** Measured, and the player was right by a wide margin. With a passive colony on the
default difficulty, the Core went from its first scratch to destroyed in **29 seconds** (652s →
681s), and 1500 HP against a sixteen-Striker wave is about seven seconds of fire. On a 300x224 map
the player is usually looking somewhere else, and nothing told them it had started.

Three changes, together:

- The Core is a fortified objective: 3200 HP, and it shoots back at 9 damage every 1.6s inside 11
  units. Measured against Strikers alone, eight leave it at about a fifth health and die trying;
  ten take it in half a minute. The opponent's standard wave of sixteen still takes it in twenty
  seconds, so the AI can still win — the player just has to bring an army and house it first, which
  is what the Definition-of-Done gate now walks through.
- The colony raises an alarm. Any structure taking damage puts a banner on screen, names what is
  being hit, plays a cue, and Space points the camera at it. It re-arms on a cooldown so a siege
  keeps saying so, and takes itself down when the shooting stops.
- The first assault lands later: earliest attack 540s → 720s on standard, 780s → 960s on relaxed,
  180s → 300s on relentless.

A passive colony on standard now survives to ~890s instead of ~686s, with roughly five minutes
between the first damage and defeat instead of twenty-nine seconds. Doing nothing still loses,
which is correct; being somewhere else for a minute no longer does.

Then a play report: "was busy building my own city then got attacked and lost" — with the alarm
working and reaching them in time. That is the honest version of the complaint, and it was not a
pacing problem: the Zap Turret was the only answer to a raid and it sat behind Generation II, so
"build a city" and "survive" were competing plans. The Turret is now a Generation I unlock at 100
Matter and 45 Energy. Measured with a colony that builds economy and defences and never produces a
single combat Agent, across three seeds on standard: unfortified it lost at 751s, 889s and 891s;
fortified it lost at 755s, held its first damage off from 382s to 877s, and on the third seed
survived the full forty minutes with the Core untouched. Fortifying is now a strategy, not a
consolation.

Two guards moved with the pacing. The `AIStrategy` cases that pinned a snapshot to a literal 600s —
now inside the standard opening — are stated relative to the preset's own constant instead, so the
next pacing change cannot silently disarm them. The wave-cadence guard is one shared helper that
bounds the typical gap and tolerates a single outlier, which is what "a cadence that does not
decay" actually means: an assault ground down away from the basin, or an opponent rebuilding after
losing an army to a defended Core, costs one gap and proves nothing. Repeated long gaps still fail.

## Manufactured resources when the map runs dry — 2026-09-04 (D8-16)

Player question: what happens when resources are exhausted, do they spawn again, and could a
futuristic world have artificial ones? They did not spawn again, nothing regrew, and a stripped
map was simply the end of the economy — Data first, since a seeded map holds roughly 5400 Matter
to 2000 Energy to 550 Data per faction.

Deposits still never regrow. Respawning rocks would erase the reason to contest the mid and wing
clusters, which is most of what the map is for. Instead a Generation II colony can manufacture what
the ground no longer holds, at a loss: a **Reclamation Plant** burns 4 Energy into 8 Matter every
two seconds, and a **Cognition Lab** burns 12 Matter and 9 Energy into 3 Data every three. Priced
against what the map actually contains, that is about three quarters of the value back on the first
and five sixths on the second — a floor under a dead economy, never a reason to stop mining a live
deposit. The Lab gets the gentler rate because Data is both the scarcest thing on the map and the
only route to Generation III.

A cycle is atomic. A colony that cannot pay converts nothing rather than half-spending, and the
plant waits, still counting, until income arrives. Cycle progress is derived state and lives in
`SynthesisSystem`, not on the entity or in the save, so a reloaded match just restarts its cycles.

Plants cost crew rather than upkeep: 2 and 3 Agent Capacity while they stand, released when they
fall. That puts the trade in the readout the player already watches — a plant or two more Agents —
and `checkInvariants` now floors `used` at live Agents plus crew, so a leaked or uncharged crew
fails the soak. A plant finished while the colony is at its cap pushes `used` past `max`: it is
already standing, and refusing the claim would let it run for free. Both plants can be switched off
from the selection panel, and the switch survives a save; a switched-off plant visibly stops
turning.

The question also exposed a gap worth fixing on its own. Only *automated* Workers were ever
re-tasked when a deposit ran out, so a hand-managed economy quietly stalled: every Worker on an
exhausted node went Idle and stayed there until the player noticed. A gather order now outlives the
rock it was aimed at — the Worker walks to the nearest live node of the same type near its **drop
point**, since gathering is a round trip and searching from the Worker sent it off to set up long
hauls. Nothing within 40 units and it idles as before; an automated Worker is left to
`AutomationSystem`, which searches the whole map for it within half a second.

The opponent builds a plant on the same terms a player would: Generation II, and only for a
resource with no live node left within 70 units of its Core.

`waves.test.ts` moved again, and this time not because behaviour got worse. Two Worker retargets
across a 35-minute match are enough to diverge a chaotic simulation; on one of the six seed and
difficulty pairs that pushed the single worst wave gap from 381s to 484s, while the opponent kept a
healthy 8-11 army and still attacked nine times. Across seeds 28-32 relentless, one pair got worse,
one got better, three were identical. The guard now bounds the *typical* gap at the same numbers
and allows one outlier up to 548s — the top of the relentless spread its own comment already
documents. A cadence that keeps stretching, which is what decay looks like, still fails.

## Walls that actually stop things — 2026-09-04 (D8-15)

Player report: "what's the point of having walls if enemies can walk through them?" They were
right, and it was never a wall bug. A* has always refused blocked cells and never cuts a diagonal
corner, so a freshly planned route was correct — but a route is planned once and then walked for
seconds, and nothing between the planner and the renderer ever looked at the grid again. A wall
raised across a route already being walked was walked straight through.

`MovementSystem` now tests every step. Only a step from open ground *into* a blocked cell is
refused; leaving a blocked cell is always allowed, because a unit can legitimately be standing in
one — built around, or nudged inside a footprint's clearance — and refusing every step out would
strand it permanently. An enclosure still holds: once the unit reaches open ground inside it,
every step into the fence is refused. A refused step reroutes; three failures and the route is
dropped, after which gather and build orders re-approach on their own and an ordered attacker
re-pursues within half a second.

The other half is that walls have to be breakable, or they become an exploit: a sealed colony
would leave an army standing in a field forever, which is a worse game than walking through the
wall. An attacker with no route to its target now turns on the nearest structure blocking it
(`breachTarget`), from `issueAttackCommand` and from `CombatSystem`'s pursuit-failure branch.

The cost is travel time — assaults walk around structures instead of through them. The relentless
worst wave gap on seed 30 moved 335s → 381s, so `waves.test.ts` now bounds relentless at 420s and
the other two at 360s. Measured across seeds 20-60 the relaxed and standard spread is 170-243s and
the relentless spread is 197-548s, which is where those two numbers come from.

## Pause, saves, Freestyle, and an open map — 2026-09-04 (D8-11 … D8-14)

Four player requests, shipped together.

**Walls (D8-11).** A Barrier Wall costs 10 Matter instead of 25 and covers 4x1 instead of 2x1 —
about a fifth of the old price per unit of fence, for a third more health. Longer, not thicker: a
one-deep wall lines up with a Gate, is what a player expects to drag out, and leaves room to build
behind it. `AI.maxWalls` dropped 8 → 5 to keep the opponent's fence the same *length* as before;
left at 8 it doubled, and the opponent walled its own Workers in often enough to stall an assault
past the cadence `waves.test.ts` enforces.

**The map's edge (D8-12).** The line in the player's screenshot was three things at once: a tree
line planted a stride inside the bounds, a hard shading band right at the boundary, and a fog
overlay that stopped exactly there while the lit meadow carried on past it. The tree line is gone,
the shading is a slow fade, the fog reaches out over the whole scenery margin, and the ground past
the bounds now climbs into hillside within twenty units instead of easing up over forty — so the
edge is a hillside rather than a line drawn across a field. The playable rectangle also grew from
240x176 to 300x224. `START_POSITIONS` deliberately did not move: every balance figure is tuned
against the distance between the two corners, so the extra ground is open country added around the
outside and nothing tuned had to be re-tuned.

**Pause and save (D8-13).** `P` holds the match and `Esc` or RESUME releases it; the overlay covers
the viewport, so a held match cannot be played through. SAVE GAME writes to one local slot, and
CONTINUE on the main menu rebuilds that match in the mode and difficulty it was saved in. A save is
a description of the world, not a snapshot of the simulation: entities, health, stock, progress, and
the match-wide totals. Paths, gather and build orders, target locks, the opponent's plan, and
explored ground are left out on purpose, so a load cannot resurrect a half-finished order into a
state no system would ever have produced — a resumed colony stands where it stood and goes back to
work, and `ConstructionSystem.adoptOrphanedSites` re-finds a builder for every half-built structure.
Id counters travel in the save; without them a restored match re-mints ids its own entities hold
and the registry throws. Fog of war is not saved and is re-explored.

**Freestyle (D8-14).** The same seeded world with nobody in the far corner: the opponent's Core and
Workers are not laid down, no opponent runs, and nothing can end the match. The deposits stay
mirrored, so the whole map is still worth crossing. The menu picks the mode; the opponent picker
only appears for Campaign.

## Building relocation — 2026-09-04 (D8-10)

Player report: "you can't move a building to another place." A completed player structure other
than the Core now offers **MOVE BUILDING** in the command deck. Taking it re-arms the existing
placement tool over that structure at its current orientation — same ghost, same snapping, `R`
still quarter-turns, Esc or right-click still cancels — and confirming a valid site re-seats the
*same entity*: id, HP, production queue, capacity contribution, and combat state all survive.
Relocation is free and instant; it is a layout correction, not an economic choice.

`RelocateCommand.ts` is the single authority. It lifts the structure off the navigation grid for
the duration of the validity check and puts it straight back, so a building never blocks its own
destination (a one-cell nudge is legal) and a refused move leaves the grid's reference counts
exactly as it found them. `BuildingEntity.footprint` and `rotated` became mutable, because a
relocation may quarter-turn a structure and its occupancy has to follow.

The same report flagged wall rotation; `R` was verified working and left alone.

## Village playtest fixes — 2026-09-03

Three defects from the user's village playtest, all regression-tested:

- **Flush wall placement (D6-15 follow-up).** `snappedPlacement` centered every footprint on a
  cell center, so a 2x1 wall straddled three half-covered cells, and the inclusive min/max cell
  ranges in `validatePlacement` and `NavigationGrid.setBlockedRect` swallowed a boundary cell the
  wall only touched — the grid rejected every neighbour as BLOCKED. Footprints now snap
  parity-aware (even axis → cell boundary, odd axis → cell center) and cell coverage is
  cell-center-based, so walls sit edge to edge while legacy straddled positions keep coverage.
  R quarter-turn was never broken; the red ghost at every adjacent spot made it look broken.
- **Idle units playing their walk animation.** `MovementSystem` stopped refreshing
  `previousPosition` once a path ran out, freezing the renderer's movement delta — idle units
  kept leg-swimming forever. `previousPosition` now syncs for every living unit.
- **Workers frozen at an unharvestable node (AI economy).** The mid matter node at (51,-40)
  sits inside `ridge-enemy-west` + padding, so its nearest walkable cell is beyond extraction
  range; `AutomationSystem` ranked it "closest" via a degenerate 1-point path and locked every
  worker onto it, starving income (exposed by the placement change, which let the AI place more).
  `gatherApproachCell` now gates manual orders, automation ranking, and re-paths; nodes no
  walkable cell can harvest are skipped. `BuildPlanner` also keeps a striker-cost Matter reserve
  once the army is the bottleneck so expansion cannot starve assault production.
  `soak.test.ts` timeout moved 60s → 90s for full-suite CPU contention (14s standalone).

## Visual overhaul — 2026-09-03

The presentation layer was rebuilt toward a dark sci-fi RTS look: a perspective camera pitched at 60°, gunmetal octagonal structures with faction light strips and warning lamps, a Core light beam, chibi mechs, a mossy forested world with stratified mesas and ponds beyond the playfield, softer fog of war drawn as a screen overlay, and a dark glass HUD with less text. Simulation, balance, and tests are unchanged. `?scenario=showcase` lays out every building and unit for review.

## Current milestone — Epic 07

Epic 07 — Survive and Ship is `DONE`. **The ship gate passed:** a clean
production build, served from static files, completes a full match in Chromium
and Firefox with no console intervention.

All nine P0 tasks are `DONE`. Two of them carried a human remainder — D7-05's
three active playtests and D7-09's hands-on browser playthrough — and both were
**waived by the project owner on 2026-09-04**, who accepted the unattended
evidence in their place: fifteen soaks at 15/15 AI victories with zero invariant
failures, a 33/33 production-preview playthrough through the end screen, Main
Menu and a clean replay, and `definitionOfDone.integration.test.ts` walking the
PRD flow end to end through the same command boundaries the HUD uses.

The seven-day build is complete and shippable.

### What Day 7 changed

Profiling found the simulation spending **94% of its time inside A\***. Two causes,
both fixed, both regression-tested:

- `AStar` picked the next node by scanning the whole open set — O(V²) on a
  42,240-cell grid. One cross-map route cost 17–24 ms, a 30-unit group order cost
  418 ms, and every search allocated half a megabyte of scratch it then threw
  away. It now uses a binary-heap open set over reused, generation-stamped
  buffers, plus a 12,000-expansion budget so an unreachable goal fails fast
  instead of sweeping the map to prove it.
- `AutomationSystem` ran a full A\* to every node of a resource type, per
  automated Worker, twice a second. It now orders candidates by straight-line
  distance and path-verifies only the nearest three.

Pursuit repathing and target acquisition also fired on the same step for every
unit under one order, so a 100-unit battle spiked to a 118 ms step; both cadences
are now jittered by a deterministic per-entity phase at an unchanged mean.

Seed-10 match wall time went **6.49 s → 0.61 s** (93x → 1017x real time); the
worst 100-unit battle step went **118.3 ms → 3.0 ms**; the test suite went
**73 s → 7 s**. No balance value changed, and pacing is where Epic 6 left it.

Two defects surfaced alongside: an unroutable move order reported success, drew a
destination marker, and left the Agent reading "Moving" forever — it now refuses
visibly; and neither HTML entry declared an icon, so every page load logged a
`/favicon.ico` 404.

Full evidence: `PERFORMANCE.md` for profiling and frame rates, `QA.md` for the
release bug board, the fifteen-run pacing table, and the browser matrix.

## Completed milestone — Epic 06

Epic 06 — Evolution is `DONE`, closed on 2026-09-03 with all sixteen tasks
complete. The Core advances Awakening → Autonomy → Singularity by spending
Matter, Energy, and gathered Data; progression unlocks Ranger and Scout
production, Zap Turrets, then the Heavy Foundry and Titan, and every existing
structure visibly rebuilds itself at each Generation.

Fog of War hides unseen entities and retains explored terrain; the AI gathers
Data and advances naturally while still discovering the player through physical
vision. Essential procedural audio, persistent sound controls, expanded end
statistics, Barrier Walls, Gates, Habitats, Storage Depots, Field Outposts, a
240 x 176 playfield, a dark sci-fi visual pass, and the menu/onboarding flow all
shipped. D6-11's usability pass was run by the project owner across three
sessions rather than an outside tester; its triage is in `QA.md`.

## Completed milestone — Epic 05

Epic 05 — The Other Intelligence is `DONE`. A deterministic local AI runs the whole loop: it gathers with automated Workers, grows to a phase Worker target, builds Relays and Fabricators on validated sites, produces and assembles an army, scouts until it observes the player Core, defends its base, launches grouped assaults, and recovers after heavy losses. F3 opens diagnostics and `runSoak` produces reproducible unattended reports.

Across five fixed seeds the AI destroys an idle player's Core in **5 of 5 runs**, median **8.5 minutes**, with zero invariant failures. D5-01 through D5-07 are `DONE`; the gate numbers were re-measured after the Epic 6 map change (5/5, median 605s) and are asserted in `src/game/ai/opponentGate.test.ts`.

## Completed milestone — Epic 04

Epic 04 is `DONE`. Units and buildings share hostility, damage, and destruction rules; a spatial hash backs 5 Hz target acquisition; Strikers acquire, pursue, attack, and retarget; pooled lasers, impacts, and collapse effects make fights readable; health bars and attack markers show combat state; and destroying either Core ends the match in Victory or Defeat with an end screen and a clean Play Again.

The user accepted the Day 4 battle gate on 2026-09-02 and every automated check is green. Epic 05 — The Other Intelligence is next.

## Completed milestone — Epic 03

Epic 03 is `DONE`. Workers place and construct Relay Nodes and Fabricators, Relays add capacity when operational, automation persists across resource depletion, Fabricators expose an ordered/cancellable Striker queue, and completed Strikers spawn into the normal selection and movement loop. The user accepted the Day 3 colony gate on 2026-09-02. The optional rally-point task D3-07 was cut to protect the seven-day P0 schedule. Epic 04 — War is next.

## Completed milestone — Epic 02

Epic 02 is `DONE`. The Day 2 build starts two equivalent factions with one Core, three Workers, equal reserves/capacity, and nearby finite Matter/Energy deposits. Player Workers can receive contextual gather orders, carry capped cargo to the Core, deposit it, and repeat. Selecting the Core exposes a paid, capacity-aware Worker queue with visible simulation-time progress and nearby spawning.

The user confirmed gathering, finite depletion, and the Core economy and accepted the Day 2 ship gate on 2026-09-02. Automated coverage and the production build are green.

## Verification

Last verified at commit `78995f5` on 2026-09-03, from a clean `npm ci`.

| Check | Result |
|---|---|
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test -- --run` | PASS — 157 tests, three consecutive runs |
| `npm run build` | PASS — only the known three.js chunk-size advisory |
| `npm run preview` + smoke | PASS — static files, correct asset paths |
| `BASE_PATH=/game/ npm run build` | PASS — sub-path assets rewritten |
| `browser-qa.mjs --headed` (Chromium) | PASS — 26/26 at 1920x1080 and 1280x720 |
| `browser-qa.mjs --headed --browser firefox` | PASS — 26/26 |
| `browser-qa.mjs --headed --full` | PASS — 33/33, unattended match to end screen, Main Menu, clean replay |
| Browser frame rate | PASS — opening colony 60 FPS, 100-unit battle 56–60 FPS |
| Pacing soaks (15 runs) | PASS — 15/15 AI wins, 0 invariant failures, difficulty strictly ordered |
| Definition of Done flow (headless) | PASS — gather → automate → produce → build → evolve → army → enemy Core |
| Interactive Day 2/3/4 gates | PASS — user accepted |
| Interactive Day 5 gate | PASS — superseded by the re-measured soak asserted in `opponentGate.test.ts` |
| Interactive Day 6 gate | PASS — owner playtests across three sessions; triage in `QA.md` |
| D7-05 active playtests | WAIVED — owner accepted the unattended soaks, 2026-09-04 |
| D7-09 hands-on browser playthrough | WAIVED — owner accepted the unattended run, 2026-09-04 |

## Epic 06 playtest response — 2026-09-03

The user played the build and raised three things: the map was too small, evolving a Generation
did not visibly upgrade buildings, and the catalog and placement rules made it impossible to
build a real village. All three are addressed as D6-14, D6-15, and D6-16.

- **Map (D6-14).** The playfield is now 240 x 176 — four times the area — with starts at the far
  corners, roomy home basins, readable mid-field lanes, and a central massif. Each faction owns a
  home cluster (Matter, Energy, and a Data archive), a mid expansion, and a far wing expansion,
  around a contested interior. Camera pan speed, zoom-out range, scene fog, the far plane, and the
  shadow frustum all widened to match.
- **Village (D6-15).** Habitat, Storage Depot, and Gate join the Awakening catalog. Village pieces
  carry zero clearance so walls sit edge to edge — previously two adjacent Barrier Walls were
  rejected outright, making a continuous wall impossible to build. `R` quarter-turns the pending
  footprint, and wall/gate/habitat placement stays armed and can be dragged into a run, spending
  once per snapped cell. A Gate blocks placement and takes damage but never blocks pathing.
- **Upgrades (D6-16).** Every building kind now gains real Generation II and Generation III
  geometry — storeys, armour, dishes, gantries, crowns, cannons — replacing the shared panel and
  orb that were the only previous upgrade cue. Structures that gain mass pop in with a burst.
  Upgrades remain purely presentational; no balance number changed.

Opponent pacing was re-tuned for the larger map, because a doubled travel distance broke the
economy the old constants assumed:

- One dedicated Data gatherer, deferred until the colony has six Workers, replaces a quarter of
  the crew being sent to archives during the opening.
- A large Energy surplus now moves gatherers back to Matter, including already-automated ones.
  Persistent automation previously banked over a thousand Energy while the Matter line starved.
- The opponent time-boxes banking Matter for its next Generation, so it evolves in every measured
  run without ever saving toward an upgrade its income can no longer reach.
- `relentless` attack force dropped from 22 to 13, which restores the difficulty ordering the
  gate asserts.

Re-measured on the shipped seeds: **5 of 5** idle-player defeats, median **605 seconds**, zero
invariant failures, and TECH reached in every run. Difficulty ordering is relentless 407s <
standard 604s < relaxed 845s. The Vitest timeout moved to 60 seconds because these suites now
simulate tens of minutes of match time on a four-times-larger map.

## Epic 06 review pass — 2026-09-03

An integration review of the whole Epic 6 diff re-ran every check (typecheck, lint, 130 tests, production build) and fixed three defects before handoff:

- **Turret target lock (correctness).** `TurretSystem` retained a target that had left its range, so one surviving hostile could keep a Zap Turret permanently silent while other enemies stood inside its arc. Retention now requires hostility *and* range; covered by a new regression test.
- **AI military production stall (correctness).** `MilitaryAI` picked one preferred unit type and returned when it was unaffordable or had no producer, so reaching Generation III without a Foundry — or losing one — stopped all military production. Production now walks a preference list and falls back to the first affordable, producible type. `EconomyAI` also keeps a Data worker at Generation III, because Rangers and Titans still consume Data.
- **Selection lookup regression (efficiency).** `Game.getSelectable` had become a linear scan that rebuilt and filtered every unit, building, and resource per lookup, making `SelectionSystem.selected()` quadratic in the 10 Hz HUD path. Restored to registry lookups behind a shared `isRevealed` vision predicate; behavior is unchanged.

`destroyEntity` now also clears building combat targets, matching the module's documented contract that no reference to a dead ID survives.

## Manual Day 6 gate checklist

Run `npm run dev`, open `/`, choose a difficulty, and press **Play**.

1. Confirm the starting Core, three Workers, nearby Matter/Energy, and bright terrain are visible while distant terrain and hostile entities remain concealed by Fog of War.
2. Gather or automate violet **Data**. Select the Core and confirm **Evolve to Autonomy** clearly shows and spends 180 Matter, 100 Energy, and 40 Data.
3. At Generation II, select a Fabricator and produce both a long-range **Ranger** and high-vision **Scout Drone**. Move the Scout outward and confirm it materially expands the revealed area.
4. Build a **Barrier Wall**, **Field Outpost**, and **Zap Turret**. Confirm the wall blocks travel, workers can deposit at the outpost, and the turret automatically shoots nearby hostiles.
5. Return to the Core and evolve to **Singularity**. Confirm existing buildings gain another visible attachment, then build a **Heavy Foundry** and produce a three-capacity **Titan**.
6. Confirm selection, orders, construction, shots, destruction, evolution, and match outcome have audio cues; mute and volume survive a page reload.
7. Finish a match. Confirm the end screen reports all three gathered resources, Agents and buildings created/destroyed/lost, final Generation, and duration; test **Play Again** and **Main Menu**.
8. Record unfamiliar-player milestone timings and confusion in `QA.md`. Epic 6 stays in `REVIEW` until this item is accepted.

## Day 5 opponent soak record

Fixed-seed unattended runs against an idle player (`runSoak`, 22-minute budget, 30 Hz):

| Seed | Result | Duration | Invariant failures |
|---|---|---:|---:|
| 10 | AI victory | 8m 31s | 0 |
| 20 | AI victory | 8m 37s | 0 |
| 30 | AI victory | 8m 24s | 0 |
| 40 | AI victory | 8m 31s | 0 |
| 50 | AI victory | 8m 30s | 0 |

Median 8m 31s, inside the 8–20 minute target. Every run passes through EXPAND_ECONOMY → SCOUT → BUILD_ARMY → ATTACK. These numbers are asserted in `src/game/ai/opponentGate.test.ts`, so a regression fails the suite.

## Manual Day 5 gate checklist

Run `npm run dev` and open `/`. Do nothing with your own colony except watch.

1. Press **F3** and confirm the overlay shows FPS, entity counts, AI state, AI goal, AI economy, forces, and intel.
2. Watch the AI state progress from EXPAND_ECONOMY through SCOUT to BUILD_ARMY. Confirm rust Workers gather and rust structures appear near the enemy Core.
3. Confirm the AI's scout physically travels to your base before its intel line changes to "player core known" — it must see you, not know you.
4. Let the match run and confirm the AI assault arrives as a group, destroys your Core, and produces **DEFEAT** in roughly 8–10 minutes.
5. Press **Play Again**, then this time attack the AI base with a few Strikers and confirm it switches to DEFEND and fights back.
6. Wipe out an AI assault and confirm it enters RECOVER, rebuilds, and attacks again rather than trickling units in.
7. Confirm your own economy, construction, production, and combat controls all still behave as they did on Day 4.

## Manual Day 4 gate record

Accepted by the user on 2026-09-02 against this checklist:

Run `npm run dev`. Open `/?scenario=battle` for the two mirrored debug armies, or `/` for the normal opening.


1. In the battle scenario, box-select your teal Strikers and right-click an enemy Striker. Confirm an orange attack marker, visible lasers and impacts, falling health bars, and a collapse effect on death.
2. Confirm your Strikers stop at weapon range instead of walking through their target, and that survivors automatically acquire the next nearby hostile.
3. Right-click an enemy building. Confirm your army paths to it, damages it, and destroys it.
4. Confirm friendly fire is impossible: right-click one of your own Agents and check that the order is refused rather than damaging it.
5. Send your army into the enemy Core and confirm **VICTORY** appears once, the simulation freezes, and HUD commands stop responding.
6. Press **Play Again** and confirm a clean new match starts with the normal opening state and no leftover selection, placement mode, or end screen.
7. Repeat with the enemy army destroying your Core (attack with fewer units, or use the battle scenario's enemy strikers) and confirm **DEFEAT**.
8. In the normal opening, fabricate Strikers, walk them into the enemy base, and confirm a full economy → construction → production → combat → match-end loop with no negative balances or stuck units.

## Manual Day 3 gate record

Accepted by the user on 2026-09-02 against this checklist:

1. Gather 80 Matter and 20 Energy, select a Worker, place a Relay, and confirm the resources are charged, a construction site appears, and the assigned Worker completes it.
2. Confirm the completed Relay raises capacity from 8 to 13. Cancel a second construction site and confirm its footprint disappears and 75% of its cost is refunded.
3. Set Workers to **Auto Matter** and **Auto Energy**. Confirm they repeatedly harvest, deposit, and choose another reachable node when one is depleted.
4. Gather 160 Matter and 80 Energy, construct a Fabricator, and confirm its controls remain unavailable until construction completes.
5. Select the Fabricator and queue multiple Strikers. Confirm cost/capacity reservation happens immediately, progress is visible, and FIFO order is preserved.
6. Click a queued item to cancel it and confirm a full refund and released reservation.
7. Confirm a finished Striker appears near the Fabricator and accepts normal selection and movement orders.
8. Run the colony for ten minutes and confirm there are no negative balances, orphaned reservations, or permanently stuck construction sites.

## Manual Day 2 gate record

Accepted by the user on 2026-09-02 against this checklist:

1. Confirm the match opens with one teal Core and three teal Workers; the rust enemy has the same starting composition.
2. Select one or more Workers and right-click the gold Matter deposit. Confirm they move, pause to extract, return to the Core, and the Matter counter rises.
3. Right-click the cyan Energy deposit and confirm the same loop raises Energy.
4. Let Workers collect at least 20 Matter, then select the teal Core and press **Fabricate Worker**.
5. Confirm Matter drops by 45 immediately, Agents shows a `+1` reservation, queue progress advances, and a fourth teal Worker appears after six simulation seconds.
6. Try queueing without enough Matter and at full capacity; confirm the last-directive readout explains the rejection.
7. Confirm ZQSD, arrow keys, two-finger pan, pinch zoom, box selection, and terrain move orders still work.

## Shipped decisions — Epic 07

- `AStar` uses a binary-heap open set over module-level scratch buffers keyed by
  grid size, with a per-search generation stamp instead of clearing. A search
  allocates nothing.
- Every search takes a hard 12,000-expansion budget. A 42,240-cell map means an
  unreachable goal would otherwise sweep the whole reachable region to answer
  "no", and a player can wall themselves in with Barrier Walls.
- Throttled per-entity work is spread by `entityPhase(id)`, a stable hash. It
  keeps the mean cadence and removes the lockstep spike, and because it is a pure
  function of the id it stays reproducible for a fixed seed.
- `AutomationSystem` ranks by straight-line distance and path-verifies only
  `AUTOMATION_PATH_CANDIDATES` nodes. Pathing to every node was the single most
  expensive thing the simulation did.
- A move order that produced no route is a refusal, not a success. `issueMoveCommand`
  reports `unreachable` separately and `Game.ts` sets activity from the routes the
  grid actually returned.
- `profileMatch` wraps systems on the instance rather than instrumenting
  `MatchSimulation.step`, so the shipped simulation carries no profiling branch.
  `pathMetrics` is the exception: two integer counters cheap enough to leave in.
- Performance guards assert deterministic cell-expansion counts, not wall clock.
  Millisecond thresholds are unstable under parallel-suite load; the few latency
  ceilings that remain are set where they still separate the heap implementation
  from the linear scan.
- `scripts/browser-qa.mjs` is the browser gate. FPS is only meaningful `--headed`
  because headless Chromium renders WebGL through SwiftShader.
- `base` comes from `BASE_PATH` at build time and defaults to the domain root.
  There is no server runtime, API, authentication, or WebSocket anywhere; the only
  persistent storage is `localStorage` for audio settings, and it degrades silently.
- No balance value changed on Day 7. The optimizations left pacing where Epic 6
  tuned it, which the re-measured soak table confirms.

## Shipped decisions — Epic 06

- `TechnologySystem` is the sole Generation gate. It spends centralized costs atomically and controls both building and production unlocks for players and AI.
- Data is a normal finite resource: Workers use the existing gather, cargo, deposit, depletion, and automation lifecycle rather than a parallel research currency path.
- Generation II unlocks Rangers, Scout Drones, and Zap Turrets; Generation III unlocks the Heavy Foundry and Titan. The Fabricator remains the compact-unit producer and the Foundry exclusively produces Titans.
- Fog runs on a 4-unit grid at roughly 6.7 Hz with unknown/explored/visible states. Player selection and rendering exclude unseen hostiles; the corrected texture orientation maps simulation Z to the ground plane correctly.
- AI scouting still uses physical observation. Once unlocked it produces and prefers a Scout for sweeps, gathers Data, chooses upgrades, limits defensive Turrets, and can complete the Foundry-to-Titan path.
- Barrier Walls and Field Outposts were added as separate D6-12/D6-13 slices in response to the user playtest. Outposts are allied deposit targets with expanded vision; walls use the normal construction, navigation, health, and destruction paths.
- All visuals remain procedural low-poly geometry. Faction color, silhouettes, warm UI surfaces, bright terrain, and additive Generation ornaments provide identity without an asset-loading dependency.
- Audio uses a bounded procedural Web Audio palette with gesture unlock and no file requests. Muting and volume persist in local storage, and missing audio support is a no-op.
- `MatchSummary` now includes Data, structures constructed, and final Generation alongside the existing duration, combat, and loss counters. New-match store actions reset it to zero.
- D6-11 remains a human gate; internal clean-browser evidence and unresolved timing fields live in `QA.md`.

## Shipped decisions — Epic 05

- `MatchSimulation` is the authoritative headless match; `Game.ts` is a presentation shell that supplies hooks for visuals, HUD, selection, and input. The rendered game and the soak harness advance identical code.
- `BuildCommand` is the single build transaction for players and AI: validate, spend, block navigation, assign a builder, roll back on failure.
- The AI mutates nothing directly. `AIContext` gives it a read-only view plus a command adapter limited to gather, automate, move, attack, build, assign-builder, and produce.
- Strategy is a pure utility function over a snapshot, evaluated at 3 Hz. Seeds are reproducible, and `Random` (mulberry32) is the only source of variation.
- The AI must observe the player Core before it can be targeted; resource locations may be assumed, per the backlog's scope decisions.
- TECH now scores an affordable next Generation and executes through the same `TechnologySystem` used by the player.
- A sustained reinforcement stall lets the AI commit a smaller force, which removed a genuine deadlock where a fully mined map could never reach the attack threshold.
- Balance constants live only in `src/data/ai.ts`; the gate seeds are asserted in tests so tuning regressions fail loudly.
- Produced entity IDs are namespaced (`-u`/`-b` suffixes) so they can never collide with scenario-authored IDs.

## Shipped decisions — Epic 04

- Combat stats (`attackDamage`, `attackRange`, `attackCooldown`, `vision`, `autoAcquires`) live in `src/data/units.ts`; pacing constants live in `src/data/combat.ts`.
- `DamageService` is the only writer of HP. It rejects friendly fire, neutral participants, and non-positive amounts, clamps HP to zero, and queues each death exactly once so systems finish iterating before anything is unregistered.
- `src/game/combat/destruction.ts` is the shared cleanup path: it clears selection, orders, and combat targets, releases used Agent Capacity and queue reservations, frees navigation occupancy, and removes capacity contributions without deleting units when a faction goes over cap.
- `SpatialHash` keeps one bucket membership per entity, so radius queries cannot return duplicates; it is re-synced once per simulation step and exposes query-load counters.
- Target acquisition is throttled to 5 Hz and only runs for idle auto-acquiring units. Attack-move was deliberately not implemented — it is not required by the Day 4 gate.
- `AttackCommand` is the shared player/AI boundary. Ordered targets are pursued without a leash; auto-acquired targets are dropped when they leave 1.5× vision.
- `EffectsManager` pools shot, impact, and collapse meshes under a hard active ceiling and drops overflow rather than allocating. Visuals never gate damage.
- Health bars are camera-facing, appear when an entity is damaged or selected, and are disposed with their entity.
- `MatchState` performs exactly one Victory/Defeat transition. After it fires, the simulation and every HUD command are frozen and the end screen shows duration, collected resources, Agents created/destroyed/lost, and buildings destroyed/lost.
- Play Again bumps a store nonce that remounts `Game`, so a new match reuses the normal disposal path instead of a bespoke reset.
- `?scenario=battle` loads mirrored debug armies; `BattleSimulation` is their headless twin for tests and future AI soak runs.
- Main Menu on the end screen stays disabled until D6-01 adds it.

## Shipped decisions

- Matter and Energy nodes are finite neutral entities with deterministic capacity, remaining amount, position, selection state, and depletion lifecycle.
- Faction ledgers enforce atomic non-negative spending and separately track gathered totals.
- Workers use explicit move → extract → return → deposit states; cargo is capped at 10 and only deposit-capable faction structures receive it.
- Manual movement replaces a gather order; depleted targets safely idle after any carried cargo is returned.
- Capacity separates used slots from queued reservations. Failed/cancelled production releases reservations; provider loss may leave a faction temporarily over cap without deleting units.
- Production charges on enqueue, advances only with fixed simulation time, preserves FIFO order, and refunds a failed spawn.
- React receives a throttled 10 Hz economy/selection snapshot. Simulation entities and transforms remain outside React state.
- The economy HUD is an operator surface: persistent top resources, contextual selection telemetry, and Core-only fabrication controls with focus/error/progress states.
- Gather commands give immediate gold/cyan target confirmation, persistent matching beacons above assigned Workers, and a red no-path rejection state.
- Decorative cyan crystals were removed so only harvestable Energy nodes use that resource silhouette.
- The fixed-seed starting layout is symmetric in composition and validated for nearby path-reachable resources.
- Placement confirmation atomically spends the building cost, creates a navigation-blocking construction site, and assigns the selected Worker; a failed assignment rolls the transaction back.
- Construction advances on fixed simulation time, shows model growth and progress, supports builder reassignment, and refunds 75% when cancelled.
- Relay capacity is applied only on completion and can be removed independently without deleting units when a faction becomes over capacity.
- Worker automation is an explicit persistent Matter/Energy mode; direct move, gather, or build commands cancel it predictably.
- Fabricator production reuses the common production queue: Strikers cost resources and capacity on enqueue, spawn FIFO, and queued cancellation gives a full refund.
- Distinct low-poly construction, Relay, Fabricator, and Striker models keep gameplay states recognizable without new bitmap assets.
- The deprecated `PCFSoftShadowMap` renderer mode was replaced with `PCFShadowMap`.
- Rally points were cut as optional P1 scope; spawned Strikers remain immediately controllable through the normal movement command.

## Known limitations

None of these prevents completing a match; all are recorded in `README.md` too.

- Worker repair of damaged friendly buildings is described in the PRD but was not
  built.
- Rally points were cut as optional post-P0 scope (D3-07). Produced Agents are
  immediately controllable through the normal movement command.
- The opponent does not build Habitats, Depots, Gates, or walls, so the village
  catalog is currently a player-facing tool.
- Peak armies sit at 14–24 units on every difficulty. The handcrafted map's finite
  deposits cap army size, not either side's willingness to build.
- Relaxed difficulty is gated by its attack timer rather than by economy: all five
  seeds finish within one second of each other, at 14m 03s.
- The main JavaScript chunk stays above Vite's advisory 500 kB because of three.js.
  It is one cached static download with no runtime cost; code-splitting it was
  judged not worth the complexity.
- Edge was not driven directly — Playwright's channel is unavailable here. It is
  Chromium-based and the Chromium column is its evidence.
- `combat` is now the largest simulation phase (~65% of step time), almost all of
  it pursuit repathing. A shared flow field for units converging on one target is
  the next lever if a measured need ever appears.
