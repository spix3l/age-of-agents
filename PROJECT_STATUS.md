# Age of Agents — Project Status

Last updated: 2026-09-02

## Current milestone

Epic 03 is `DONE`. Workers place and construct Relay Nodes and Fabricators, Relays add capacity when operational, automation persists across resource depletion, Fabricators expose an ordered/cancellable Striker queue, and completed Strikers spawn into the normal selection and movement loop. The user accepted the Day 3 colony gate on 2026-09-02. The optional rally-point task D3-07 was cut to protect the seven-day P0 schedule. Epic 04 — War is next.

## Completed milestone — Epic 02

Epic 02 is `DONE`. The Day 2 build starts two equivalent factions with one Core, three Workers, equal reserves/capacity, and nearby finite Matter/Energy deposits. Player Workers can receive contextual gather orders, carry capped cargo to the Core, deposit it, and repeat. Selecting the Core exposes a paid, capacity-aware Worker queue with visible simulation-time progress and nearby spawning.

The user confirmed gathering, finite depletion, and the Core economy and accepted the Day 2 ship gate on 2026-09-02. Automated coverage and the production build are green.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test -- --run` | PASS — 21 files, 41 tests |
| `npm run build` | PASS |
| Dev server HTTP boot | PASS — `/` returned HTTP 200 |
| Interactive Day 2 gate | PASS — user accepted |
| Interactive Day 3 gate | PASS — user accepted |

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

- Three.js keeps the main production JavaScript chunk above Vite's advisory 500 kB threshold. This remains non-blocking until the performance epic.
- Rally points remain optional post-P0 scope.
