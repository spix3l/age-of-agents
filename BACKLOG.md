# Age of Agents — Seven-Day Build Backlog

This is the portfolio view for the file-backed backlog derived from [`PRD.md`](PRD.md). Read the [operating rules](backlog/README.md) before claiming work. Each task file is the source of truth for its status and owner.

## Epics

| Epic | Schedule | Outcome | Tasks | Status |
|---|---|---|---:|---|
| [EPIC-01](backlog/epics/EPIC-01-world.md) | Day 1 | The World | 9 | DONE |
| [EPIC-02](backlog/epics/EPIC-02-economy.md) | Day 2 | The Machine Economy | 7 | DONE |
| [EPIC-03](backlog/epics/EPIC-03-colony.md) | Day 3 | Build the Colony | 8 | DONE |
| [EPIC-04](backlog/epics/EPIC-04-war.md) | Day 4 | War | 7 | DONE |
| [EPIC-05](backlog/epics/EPIC-05-opponent.md) | Day 5 | The Other Intelligence | 7 | DONE |
| [EPIC-06](backlog/epics/EPIC-06-evolution.md) | Day 6 | Evolution | 16 | DONE |
| [EPIC-07](backlog/epics/EPIC-07-release.md) | Day 7 | Survive and Ship | 9 | DONE |
| [EPIC-08](backlog/epics/EPIC-08-depth.md) | Day 8 | Depth and Replayability | 6 | TODO |

## Tasks

| Task | Epic | Title | Pri | Est | Depends on | Status |
|---|---|---|---:|:---:|---|---|
| [D1-01](backlog/tasks/D1-01.md) | [EPIC-01](backlog/epics/EPIC-01-world.md) | Scaffold the application and quality gates | P0 | M | — | DONE |
| [D1-02](backlog/tasks/D1-02.md) | [EPIC-01](backlog/epics/EPIC-01-world.md) | Define simulation contracts and balance data | P0 | M | D1-01 | DONE |
| [D1-03](backlog/tasks/D1-03.md) | [EPIC-01](backlog/epics/EPIC-01-world.md) | Build the Three.js world shell | P0 | M | D1-01 | DONE |
| [D1-04](backlog/tasks/D1-04.md) | [EPIC-01](backlog/epics/EPIC-01-world.md) | Implement fixed-step game loop and entity registry | P0 | M | D1-02, D1-03 | DONE |
| [D1-05](backlog/tasks/D1-05.md) | [EPIC-01](backlog/epics/EPIC-01-world.md) | Implement RTS camera controls and bounds | P0 | S | D1-03 | DONE |
| [D1-06](backlog/tasks/D1-06.md) | [EPIC-01](backlog/epics/EPIC-01-world.md) | Build navigation grid and A* | P0 | L | D1-02 | DONE |
| [D1-07](backlog/tasks/D1-07.md) | [EPIC-01](backlog/epics/EPIC-01-world.md) | Implement unit movement and group destination slots | P0 | L | D1-04, D1-06 | DONE |
| [D1-08](backlog/tasks/D1-08.md) | [EPIC-01](backlog/epics/EPIC-01-world.md) | Implement click and drag-box selection | P0 | M | D1-04, D1-05 | DONE |
| [D1-09](backlog/tasks/D1-09.md) | [EPIC-01](backlog/epics/EPIC-01-world.md) | Integrate and prove the Day 1 world gate | P0 | M | D1-07, D1-08 | DONE |
| [D2-01](backlog/tasks/D2-01.md) | [EPIC-02](backlog/epics/EPIC-02-economy.md) | Add player economy and resource-node model | P0 | M | D1-04 | DONE |
| [D2-02](backlog/tasks/D2-02.md) | [EPIC-02](backlog/epics/EPIC-02-economy.md) | Implement Worker gathering state machine | P0 | L | D1-07, D2-01 | DONE |
| [D2-03](backlog/tasks/D2-03.md) | [EPIC-02](backlog/epics/EPIC-02-economy.md) | Add Core, ownership, and deposits | P0 | M | D1-04, D2-01 | DONE |
| [D2-04](backlog/tasks/D2-04.md) | [EPIC-02](backlog/epics/EPIC-02-economy.md) | Implement Agent Capacity rules | P0 | S | D1-02, D2-03 | DONE |
| [D2-05](backlog/tasks/D2-05.md) | [EPIC-02](backlog/epics/EPIC-02-economy.md) | Implement production queues and Worker spawning | P0 | M | D2-03, D2-04 | DONE |
| [D2-06](backlog/tasks/D2-06.md) | [EPIC-02](backlog/epics/EPIC-02-economy.md) | Build resource, selection, and Core action HUD | P0 | L | D2-01, D2-05 | DONE |
| [D2-07](backlog/tasks/D2-07.md) | [EPIC-02](backlog/epics/EPIC-02-economy.md) | Create fair starting state and economy tests | P0 | M | D2-02, D2-05, D2-06 | DONE |
| [D3-01](backlog/tasks/D3-01.md) | [EPIC-03](backlog/epics/EPIC-03-colony.md) | Implement placement validation and building ghosts | P0 | L | D1-06, D2-01 | DONE |
| [D3-02](backlog/tasks/D3-02.md) | [EPIC-03](backlog/epics/EPIC-03-colony.md) | Implement construction sites and Worker building | P0 | L | D2-02, D3-01 | DONE |
| [D3-03](backlog/tasks/D3-03.md) | [EPIC-03](backlog/epics/EPIC-03-colony.md) | Add Relay Node capacity integration | P0 | S | D2-04, D3-02 | DONE |
| [D3-04](backlog/tasks/D3-04.md) | [EPIC-03](backlog/epics/EPIC-03-colony.md) | Add Fabricator and Striker production | P0 | M | D2-05, D3-02 | DONE |
| [D3-05](backlog/tasks/D3-05.md) | [EPIC-03](backlog/epics/EPIC-03-colony.md) | Add queue UI and cancel/refund behavior | P0 | M | D2-06, D3-04 | DONE |
| [D3-06](backlog/tasks/D3-06.md) | [EPIC-03](backlog/epics/EPIC-03-colony.md) | Implement persistent economic automation | P0 | M | D2-02 | DONE |
| [D3-07](backlog/tasks/D3-07.md) | [EPIC-03](backlog/epics/EPIC-03-colony.md) | Implement rally points | P1 | S | D3-04 | CUT |
| [D3-08](backlog/tasks/D3-08.md) | [EPIC-03](backlog/epics/EPIC-03-colony.md) | Integrate and prove the Day 3 colony gate | P0 | M | D3-03, D3-04, D3-05, D3-06 | DONE |
| [D4-01](backlog/tasks/D4-01.md) | [EPIC-04](backlog/epics/EPIC-04-war.md) | Add teams, health, damage, and destruction lifecycle | P0 | M | D1-04, D3-04 | DONE |
| [D4-02](backlog/tasks/D4-02.md) | [EPIC-04](backlog/epics/EPIC-04-war.md) | Build spatial hash and hostile target queries | P0 | M | D1-04 | DONE |
| [D4-03](backlog/tasks/D4-03.md) | [EPIC-04](backlog/epics/EPIC-04-war.md) | Implement Attack command and combat state machine | P0 | L | D1-07, D4-01, D4-02 | DONE |
| [D4-04](backlog/tasks/D4-04.md) | [EPIC-04](backlog/epics/EPIC-04-war.md) | Add readable laser/projectile and impact effects | P0 | M | D4-03 | DONE |
| [D4-05](backlog/tasks/D4-05.md) | [EPIC-04](backlog/epics/EPIC-04-war.md) | Add health bars, command markers, and death feedback | P0 | M | D4-01, D4-03 | DONE |
| [D4-06](backlog/tasks/D4-06.md) | [EPIC-04](backlog/epics/EPIC-04-war.md) | Implement Core destruction and match end | P0 | M | D4-01, D2-06 | DONE |
| [D4-07](backlog/tasks/D4-07.md) | [EPIC-04](backlog/epics/EPIC-04-war.md) | Integrate and prove the Day 4 battle gate | P0 | M | D4-04, D4-05, D4-06 | DONE |
| [D5-01](backlog/tasks/D5-01.md) | [EPIC-05](backlog/epics/EPIC-05-opponent.md) | Create AI controller, utility states, and command adapter | P0 | M | D3-08, D4-07 | DONE |
| [D5-02](backlog/tasks/D5-02.md) | [EPIC-05](backlog/epics/EPIC-05-opponent.md) | Implement AI gathering and Worker production | P0 | L | D5-01 | DONE |
| [D5-03](backlog/tasks/D5-03.md) | [EPIC-05](backlog/epics/EPIC-05-opponent.md) | Implement AI building and capacity management | P0 | L | D5-01, D5-02 | DONE |
| [D5-04](backlog/tasks/D5-04.md) | [EPIC-05](backlog/epics/EPIC-05-opponent.md) | Implement AI military production and army assembly | P0 | M | D5-03 | DONE |
| [D5-05](backlog/tasks/D5-05.md) | [EPIC-05](backlog/epics/EPIC-05-opponent.md) | Implement AI scouting, defense, attack, and recovery | P0 | L | D5-04 | DONE |
| [D5-06](backlog/tasks/D5-06.md) | [EPIC-05](backlog/epics/EPIC-05-opponent.md) | Add AI observability and deterministic soak scenario | P0 | M | D5-05 | DONE |
| [D5-07](backlog/tasks/D5-07.md) | [EPIC-05](backlog/epics/EPIC-05-opponent.md) | Balance and prove the Day 5 opponent gate | P0 | L | D5-06 | DONE |
| [D6-01](backlog/tasks/D6-01.md) | [EPIC-06](backlog/epics/EPIC-06-evolution.md) | Add main menu, how-to-play, and match restart | P0 | M | D4-06 | DONE |
| [D6-02](backlog/tasks/D6-02.md) | [EPIC-06](backlog/epics/EPIC-06-evolution.md) | Add Data and three-Generation progression | P1 | L | D5-07 | DONE |
| [D6-03](backlog/tasks/D6-03.md) | [EPIC-06](backlog/epics/EPIC-06-evolution.md) | Implement grid Fog of War | P1 | L | D4-02, D5-07 | DONE |
| [D6-04](backlog/tasks/D6-04.md) | [EPIC-06](backlog/epics/EPIC-06-evolution.md) | Add Ranger to the Fabricator | P1 | M | D4-03, D6-02 | DONE |
| [D6-05](backlog/tasks/D6-05.md) | [EPIC-06](backlog/epics/EPIC-06-evolution.md) | Add Scout Drone and exploration role | P1 | M | D6-03, D6-02 | DONE |
| [D6-06](backlog/tasks/D6-06.md) | [EPIC-06](backlog/epics/EPIC-06-evolution.md) | Add Heavy Foundry and Titan | P1 | L | D3-02, D4-03, D6-02 | DONE |
| [D6-07](backlog/tasks/D6-07.md) | [EPIC-06](backlog/epics/EPIC-06-evolution.md) | Add automatic Defense Turret | P1 | M | D3-02, D4-03, D6-02 | DONE |
| [D6-08](backlog/tasks/D6-08.md) | [EPIC-06](backlog/epics/EPIC-06-evolution.md) | Add essential audio with safe fallbacks | P1 | M | D4-04, D6-01 | DONE |
| [D6-09](backlog/tasks/D6-09.md) | [EPIC-06](backlog/epics/EPIC-06-evolution.md) | Establish low-poly faction identity and generation cues | P1 | M | D6-02 | DONE |
| [D6-10](backlog/tasks/D6-10.md) | [EPIC-06](backlog/epics/EPIC-06-evolution.md) | Add end-game statistics | P1 | M | D4-06, D6-01 | DONE |
| [D6-11](backlog/tasks/D6-11.md) | [EPIC-06](backlog/epics/EPIC-06-evolution.md) | Run external-tester usability pass and triage | P0 | M | D6-01 | DONE |
| [D6-12](backlog/tasks/D6-12.md) | [EPIC-06](backlog/epics/EPIC-06-evolution.md) | Add modular Barrier Walls | P1 | S | D3-02, D4-01 | DONE |
| [D6-13](backlog/tasks/D6-13.md) | [EPIC-06](backlog/epics/EPIC-06-evolution.md) | Add remote-deposit Field Outpost | P1 | M | D2-03, D3-02, D6-03 | DONE |
| [D6-14](backlog/tasks/D6-14.md) | [EPIC-06](backlog/epics/EPIC-06-evolution.md) | Double the battlefield and refill it | P1 | M | D6-03 | DONE |
| [D6-15](backlog/tasks/D6-15.md) | [EPIC-06](backlog/epics/EPIC-06-evolution.md) | Make colonies buildable as villages | P1 | M | D6-12, D6-13 | DONE |
| [D6-16](backlog/tasks/D6-16.md) | [EPIC-06](backlog/epics/EPIC-06-evolution.md) | Give every structure real Generation upgrades | P1 | M | D6-02, D6-09 | DONE |
| [D7-01](backlog/tasks/D7-01.md) | [EPIC-07](backlog/epics/EPIC-07-release.md) | Freeze scope and build the release bug board | P0 | S | D5-07, D6-01 | DONE |
| [D7-02](backlog/tasks/D7-02.md) | [EPIC-07](backlog/epics/EPIC-07-release.md) | Add full-loop smoke and invariant tests | P0 | L | D7-01 | DONE |
| [D7-03](backlog/tasks/D7-03.md) | [EPIC-07](backlog/epics/EPIC-07-release.md) | Fix navigation and stuck-unit release blockers | P0 | L | D7-01 | DONE |
| [D7-04](backlog/tasks/D7-04.md) | [EPIC-07](backlog/epics/EPIC-07-release.md) | Profile and optimize large battles | P0 | L | D7-01 | DONE |
| [D7-05](backlog/tasks/D7-05.md) | [EPIC-07](backlog/epics/EPIC-07-release.md) | Balance match pacing and AI reliability | P0 | L | D7-01 | DONE |
| [D7-06](backlog/tasks/D7-06.md) | [EPIC-07](backlog/epics/EPIC-07-release.md) | Perform keyboard/mouse UX and browser QA | P0 | M | D7-02, D7-03 | DONE |
| [D7-07](backlog/tasks/D7-07.md) | [EPIC-07](backlog/epics/EPIC-07-release.md) | Verify static production deployment | P0 | M | D7-02, D7-04 | DONE |
| [D7-08](backlog/tasks/D7-08.md) | [EPIC-07](backlog/epics/EPIC-07-release.md) | Finalize project status and agent handoff | P0 | S | D7-05, D7-06, D7-07 | DONE |
| [D7-09](backlog/tasks/D7-09.md) | [EPIC-07](backlog/epics/EPIC-07-release.md) | Execute clean-browser release playthrough | P0 | M | D7-08 | DONE |
| [D8-01](backlog/tasks/D8-01.md) | [EPIC-08](backlog/epics/EPIC-08-depth.md) | Correct the camera to an isometric read | P1 | S | D7-09 | TODO |
| [D8-02](backlog/tasks/D8-02.md) | [EPIC-08](backlog/epics/EPIC-08-depth.md) | Make the AI recover and keep attacking | P1 | M | D7-09 | TODO |
| [D8-03](backlog/tasks/D8-03.md) | [EPIC-08](backlog/epics/EPIC-08-depth.md) | Seed map variation and enrich resources | P1 | L | D7-09 | TODO |
| [D8-04](backlog/tasks/D8-04.md) | [EPIC-08](backlog/epics/EPIC-08-depth.md) | Add a minimap | P1 | M | D8-03 | TODO |
| [D8-05](backlog/tasks/D8-05.md) | [EPIC-08](backlog/epics/EPIC-08-depth.md) | Make match results shareable | P1 | M | D7-09 | TODO |
| [D8-06](backlog/tasks/D8-06.md) | [EPIC-08](backlog/epics/EPIC-08-depth.md) | Player-versus-player | P2 | L | D8-01, D8-03 | DEFERRED |

## Release rule

Release is allowed only when every P0 task is `DONE` or replaced by a documented simpler implementation that still passes its epic gate; typecheck, tests, and production build pass; the clean-browser playthrough passes; and `PROJECT_STATUS.md` truthfully records all shipped and cut scope.
