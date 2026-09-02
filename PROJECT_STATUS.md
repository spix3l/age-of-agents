# Age of Agents — Project Status

Last updated: 2026-09-02

## Current milestone

Epic 05 — The Other Intelligence is implemented and in `REVIEW`. A deterministic local AI runs the whole loop: it gathers with automated Workers, grows to a phase Worker target, builds Relays and Fabricators on validated sites, produces and assembles Strikers, scouts until it observes the player Core, defends its base, launches grouped assaults, and recovers after heavy losses. F3 opens a diagnostics overlay and `runSoak` produces reproducible unattended reports.

Across five fixed seeds the AI destroys an idle player's Core in **5 of 5 runs**, median **8.5 minutes**, with zero invariant failures. D5-01 through D5-06 are `DONE`. **D5-07 stays `REVIEW` until the user watches an unattended match and accepts the Day 5 opponent gate below.**

Getting here required one architectural change: `src/game/match/MatchSimulation.ts` now owns the authoritative match (entities, systems, destruction, match end) with no Three.js, DOM, or React, and `Game.ts` is a presentation/input shell around it. Human and AI actions run the exact same code.

## Completed milestone — Epic 04

Epic 04 is `DONE`. Units and buildings share hostility, damage, and destruction rules; a spatial hash backs 5 Hz target acquisition; Strikers acquire, pursue, attack, and retarget; pooled lasers, impacts, and collapse effects make fights readable; health bars and attack markers show combat state; and destroying either Core ends the match in Victory or Defeat with an end screen and a clean Play Again.

The user accepted the Day 4 battle gate on 2026-09-02 and every automated check is green. Epic 05 — The Other Intelligence is next.

## Completed milestone — Epic 03

Epic 03 is `DONE`. Workers place and construct Relay Nodes and Fabricators, Relays add capacity when operational, automation persists across resource depletion, Fabricators expose an ordered/cancellable Striker queue, and completed Strikers spawn into the normal selection and movement loop. The user accepted the Day 3 colony gate on 2026-09-02. The optional rally-point task D3-07 was cut to protect the seven-day P0 schedule. Epic 04 — War is next.

## Completed milestone — Epic 02

Epic 02 is `DONE`. The Day 2 build starts two equivalent factions with one Core, three Workers, equal reserves/capacity, and nearby finite Matter/Energy deposits. Player Workers can receive contextual gather orders, carry capped cargo to the Core, deposit it, and repeat. Selecting the Core exposes a paid, capacity-aware Worker queue with visible simulation-time progress and nearby spawning.

The user confirmed gathering, finite depletion, and the Core economy and accepted the Day 2 ship gate on 2026-09-02. Automated coverage and the production build are green.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test -- --run` | PASS — 36 files, 109 tests |
| `npm run build` | PASS |
| Dev server HTTP boot | PASS — `/` returned HTTP 200 |
| Interactive Day 2 gate | PASS — user accepted |
| Interactive Day 3 gate | PASS — user accepted |
| Interactive Day 4 gate | PASS — user accepted |
| Automated Day 5 soak | PASS — 5/5 AI wins, 0 invariant failures |
| Interactive Day 5 gate | PENDING — awaiting user |

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

## Shipped decisions — Epic 05

- `MatchSimulation` is the authoritative headless match; `Game.ts` is a presentation shell that supplies hooks for visuals, HUD, selection, and input. The rendered game and the soak harness advance identical code.
- `BuildCommand` is the single build transaction for players and AI: validate, spend, block navigation, assign a builder, roll back on failure.
- The AI mutates nothing directly. `AIContext` gives it a read-only view plus a command adapter limited to gather, automate, move, attack, build, assign-builder, and produce.
- Strategy is a pure utility function over a snapshot, evaluated at 3 Hz. Seeds are reproducible, and `Random` (mulberry32) is the only source of variation.
- The AI must observe the player Core before it can be targeted; resource locations may be assumed, per the backlog's scope decisions.
- TECH exists as a scored placeholder pinned at zero until D6-02 introduces Generations.
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

## Known follow-ups

- The AI's median win lands near the low end of the 8–20 minute target because the handcrafted map's finite deposits cap how large an army either side can field. Revisit alongside D7-05 pacing.
- The AI does not yet respect Fog of War (D6-03) beyond the Core-discovery rule, and has no Generation progression until D6-02.
- Buildings cannot fight back; the automatic Defense Turret remains D6-07 scope.
- Worker repair of damaged friendly buildings is specified in the PRD but is not Day 4 scope.
- Three.js keeps the main production JavaScript chunk above Vite's advisory 500 kB threshold. This remains non-blocking until the performance epic.
- Rally points remain optional post-P0 scope.
