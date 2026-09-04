# AGE OF AGENTS

## Product Requirements Document & Technical Design Specification

**Document Version:** 1.0
**Project Codename:** Age of Agents
**Genre:** Real-Time Strategy
**Platform:** Desktop Web Browser
**Visual Style:** Stylized Low-Poly Sci-Fi
**Game Mode:** Single Player vs AI
**Target Match Length:** 15–25 minutes
**Development Constraint:** 7-day AI development challenge
**Architecture:** Local-first, client-side only, static deployable
**Backend:** None for V1

---

# 1. Executive Summary

Age of Agents is a browser-based real-time strategy game set in a futuristic world populated by autonomous machines.

The player controls an artificial intelligence known as a **Core**. The Core creates robotic agents, gathers resources, builds infrastructure, evolves technologically, automates its economy, produces military forces, and ultimately attempts to destroy the enemy Core.

The game draws inspiration from classic economy-driven RTS games while establishing its own identity around:

* autonomous agents;
* automation;
* artificial intelligence;
* robots;
* technological evolution;
* lasers and energy weapons;
* large-scale machine warfare.

The core fantasy is:

> Start as a primitive machine intelligence and evolve into an autonomous technological war machine.

The primary gameplay loop is:

**Explore → Gather → Build → Automate → Evolve → Fight → Conquer**

The V1 must run entirely inside the player's browser without requiring a backend server.

---

# 2. Product Vision

Age of Agents should feel like a small but complete RTS rather than a technical prototype.

A player opening the game should quickly understand that they control a machine civilization.

They begin with almost nothing.

Over the course of approximately twenty minutes, the battlefield should transform from an empty landscape containing a few primitive robots into two automated machine civilizations fighting with lasers, drones, turrets, and giant combat machines.

The transformation of the player's civilization is one of the primary emotional rewards.

Early game:

> "I need resources."

Mid game:

> "My base is becoming automated."

Late game:

> "I have created a machine empire."

---

# 3. Product Pillars

## 3.1 Build

Players physically create their machine civilization.

Buildings should visibly appear under construction and progressively become operational.

---

## 3.2 Automate

Automation is a core thematic and gameplay mechanic.

As the player's technology improves, agents should require less micromanagement.

---

## 3.3 Evolve

Technological progression should create noticeable changes in:

* available units;
* available buildings;
* weapons;
* automation;
* visual appearance;
* military power.

---

## 3.4 Conquer

Ultimately, the economy exists to support warfare.

The game must culminate in large, readable, visually satisfying battles.

---

# 4. Target Experience

The ideal first match should create the following progression:

### Minute 0–3

"I need to understand this world."

The player gathers basic resources and produces workers.

### Minute 3–7

"I'm building something."

The player establishes production infrastructure and begins automating the economy.

### Minute 7–12

"There's another intelligence out there."

Scouting reveals the enemy civilization.

Small military encounters begin.

### Minute 12–18

"We are at war."

Both civilizations produce armies and fight over resources.

### Minute 18–25

"One of us has to die."

Advanced units enter the battlefield and one Core is destroyed.

---

# 5. Victory and Defeat

Each player owns one **Core**.

The Core is the central structure of the civilization.

It is heavily built and defends itself: a raid that walks up to a Core is punished, and taking one
down requires a real army rather than a first wave. A colony under attack anywhere is told so, and
can put the camera on the fight immediately.

## Victory

Destroy the enemy Core.

## Defeat

Your Core is destroyed.

No additional victory conditions are required for V1.

---

# 6. Starting State

Each player begins with:

* 1 Core;
* 3 Worker Agents;
* small starting resource reserves;
* low initial unit capacity;
* nearby basic resources.

Both players must have reasonably equivalent starting conditions.

The enemy is initially hidden by Fog of War.

---

# 7. Resources

Age of Agents uses three resources.

---

## 7.1 Matter

Represents physical materials.

Primary uses:

* buildings;
* basic units;
* infrastructure;
* repairs.

Sources:

* mineral formations;
* scrap deposits;
* metallic rocks.

Visual language:

large metallic/crystalline deposits.

---

## 7.2 Energy

Represents usable electrical/thermal energy.

Primary uses:

* advanced units;
* military production;
* technological progression;
* advanced structures.

Sources:

* energy crystals;
* geothermal nodes;
* power deposits.

Visual language:

glowing, emissive resources.

---

## 7.3 Data

Represents knowledge, computation, and machine intelligence.

Primary uses:

* research;
* generation upgrades;
* advanced automation;
* elite technologies.

Sources:

**Data Nodes**

Data Nodes should be relatively scarce and strategically valuable.

This creates territorial conflict around technologically important areas.

---

## 7.4 Exhaustion and Synthesis

Deposits are finite and never regrow. Running the ground dry is a phase of a long match, not a bug
to be patched with respawning rocks: permanence is what makes the mid-field and wing clusters worth
contesting.

A Generation II colony answers exhaustion the way an artificial intelligence would — it
manufactures. Two crewed structures convert what the colony still has into what it no longer holds:

* **Reclamation Plant** — Energy into Matter;
* **Cognition Lab** — Matter and Energy into Data.

Every recipe is a loss, priced against how much of each resource a seeded map actually contains,
and every plant occupies Agent Capacity while it runs. Synthesis is the floor under a dead economy;
mining a live deposit is always better. A plant can be switched off when the colony would rather
spend its input elsewhere.

---

# 8. Worker Agents

Worker Agents replace traditional RTS villagers.

They are small utility robots responsible for:

* gathering resources;
* transporting resources;
* constructing buildings;
* repairing structures;
* optionally performing very weak defensive attacks.

Worker Agents are produced by the Core.

---

# 9. Resource Gathering

Resource collection should be physical and visible.

Basic loop:

**Locate resource → Move → Extract → Carry → Return → Deposit → Repeat**

Workers have limited carrying capacity.

Example:

**10 Matter**

When full, the Worker returns to the nearest valid deposit structure, transfers the resource, and resumes gathering.

The player should be able to understand what a Worker is doing from its animation and UI state.

---

# 10. Automation

Automation is a signature mechanic.

Traditional direct RTS orders remain available, but the player can assign persistent behaviors.

Example:

**AUTOMATE: MATTER**

The Worker Agent should:

1. locate a valid Matter source;
2. travel to it;
3. extract Matter;
4. return resources;
5. repeat;
6. automatically locate another nearby source when depleted.

Additional automation commands may include:

**AUTOMATE: ENERGY**

**AUTOMATE: DATA**

Military automation may eventually include:

**DEFEND AREA**

**PATROL**

**SCOUT**

**ATTACK AREA**

For V1, economic automation is higher priority than sophisticated military automation.

---

# 11. Unit Capacity

Instead of traditional "population," Age of Agents uses:

**Agent Capacity**

Example:

**17 / 25 Agents**

Every unit consumes capacity.

Example values:

Worker Agent: 1
Striker: 1
Ranger: 1
Scout Drone: 1
Titan: 3

Capacity is increased by constructing **Relay Nodes**.

---

# 12. Building Construction

A Worker Agent can construct buildings.

Flow:

1. select Worker;
2. select building;
3. building ghost follows cursor;
4. valid placement appears visually;
5. player confirms placement;
6. resources are consumed;
7. construction site appears;
8. Worker moves to site;
9. construction progresses;
10. building becomes operational.

Placement states:

**Valid**

**Invalid**

Buildings cannot overlap:

* other buildings;
* major resource deposits;
* blocked terrain;
* map boundaries.

---

# 13. Buildings

## 13.1 Core

The center of the civilization.

Functions:

* produces Worker Agents;
* receives resources;
* unlocks generation advancement;
* provides initial Agent Capacity;
* acts as the defeat condition.

The Core should be the most visually recognizable structure.

---

## 13.2 Relay Node

Increases Agent Capacity.

Equivalent strategic function to an RTS house.

Visually:

antenna / communication / power relay structure.

---

## 13.3 Fabricator

Produces basic military robots.

Primary unit:

**Striker**

---

## 13.4 Ranger Facility

Produces ranged combat agents.

Primary unit:

**Ranger**

May be merged with Fabricator if scope becomes problematic.

---

## 13.5 Drone Bay

Produces:

**Scout Drone**

Potential future combat drones.

---

## 13.6 Heavy Foundry

Produces:

**Titan**

Expensive late-game building.

---

## 13.7 Defense Turret

Automatic defensive structure.

Characteristics:

* stationary;
* long range;
* laser weapon;
* automatic targeting;
* strong against small groups;
* vulnerable when overwhelmed.

---

## 13.8 Research Array

Provides technological upgrades.

Can be simplified or removed if necessary during the 7-day challenge.

---

# 14. Unit Roster

The V1 roster should remain deliberately small.

---

## 14.1 Worker Agent

Role:

**Economy / Construction**

Properties:

* low HP;
* low damage;
* medium movement;
* resource gathering;
* construction;
* repair.

---

## 14.2 Striker

Role:

**Basic frontline combat**

Visual concept:

small aggressive combat robot.

Weapon:

short-range energy weapon / plasma weapon.

Characteristics:

* inexpensive;
* durable for cost;
* short range;
* medium movement speed.

---

## 14.3 Ranger

Role:

**Long-range damage**

Visual concept:

bipedal precision combat robot.

Weapon:

laser rifle / energy cannon.

Characteristics:

* long range;
* good damage;
* low durability;
* vulnerable when surrounded.

Projectile should be visually readable.

---

## 14.4 Scout Drone

Role:

**Reconnaissance**

Characteristics:

* very fast;
* low HP;
* large vision radius;
* minimal combat ability.

Primary purpose:

Fog of War exploration.

---

## 14.5 Titan

Role:

**Late-game heavy unit**

Visual concept:

large low-poly mech.

Characteristics:

* very expensive;
* high Agent Capacity cost;
* high HP;
* high damage;
* slower movement;
* visually intimidating.

The arrival of a Titan should feel significant.

---

# 15. Combat Model

Every combat unit has:

* maximum HP;
* attack damage;
* attack range;
* attack cooldown;
* movement speed;
* vision radius;
* Agent Capacity cost;
* resource cost;
* production time.

Basic combat loop:

**Acquire target → Move into range → Attack → Cooldown → Repeat**

When the current target is destroyed, units may automatically acquire another nearby hostile target.

---

# 16. Combat Feedback

Combat must remain readable even with dozens of units.

Required feedback:

* selection indicator;
* health bars;
* laser/projectile effects;
* impact effects;
* attack animations;
* destruction animations;
* sound effects.

Visual spectacle should come primarily from:

* lasers;
* projectiles;
* explosions;
* glowing energy effects;
* collapsing robots;
* Titan weapons.

Avoid excessive particle counts that compromise browser performance.

---

# 17. Technology Progression

Instead of historical Ages, the civilization evolves through machine generations.

---

## GENERATION I — AWAKENING

Theme:

Primitive autonomous machine colony.

Focus:

* economy;
* basic construction;
* basic military.

Available:

* Worker Agent;
* Relay Node;
* Fabricator;
* Striker.

Visual style:

industrial, exposed mechanical components, simple structures.

---

## GENERATION II — AUTONOMY

Theme:

The machine intelligence becomes self-sufficient.

Focus:

* ranged combat;
* scouting;
* automation;
* defensive infrastructure.

Unlocks:

* Ranger;
* Scout Drone;
* Defense Turret;
* advanced automation.

Visual style:

cleaner structures, emissive components, stronger energy effects.

---

## GENERATION III — SINGULARITY

Theme:

The machine civilization reaches technological supremacy.

Focus:

* heavy warfare;
* advanced technologies;
* powerful autonomous systems.

Unlocks:

* Heavy Foundry;
* Titan;
* late-game upgrades.

Generation transition message:

**SINGULARITY ACHIEVED**

Visual style:

advanced geometric structures, strong energy cores, holographic elements, powerful emissive lighting.

---

# 18. Visual Evolution

Generation progression must be visually obvious.

Possible techniques:

* material changes;
* emissive intensity;
* additional building components;
* antenna arrays;
* holographic effects;
* animated energy cores;
* more advanced unit silhouettes.

Full replacement of every model is not required.

A modular upgrade approach is preferred.

---

# 19. Fog of War

The game uses three visibility states.

## Unknown

Never explored.

Completely hidden.

## Explored

Previously explored but not currently visible.

Terrain remains visible but darkened.

Enemy units are hidden.

## Visible

Currently inside friendly vision.

Normal rendering.

Every unit and building has a:

**Vision Radius**

Scout Drones should have significantly higher vision than normal units.

---

# 20. Map

V1 contains one primary battlefield.

The map should contain:

* open terrain;
* Matter deposits;
* Energy deposits;
* Data Nodes;
* obstacles;
* decorative environmental assets.

Resource distribution should naturally create contested areas.

Data Nodes should often appear outside safe starting zones.

---

# 21. Procedural Generation

The battlefield should preferably support seeded procedural generation.

Seed determines:

* resource locations;
* decorative objects;
* obstacle placement.

Generation rules must guarantee each player receives reasonable access to:

* Matter;
* Energy;
* at least one reachable Data source.

Fairness is more important than procedural complexity.

If procedural generation threatens the deadline, use a handcrafted map with randomized resource variations.

---

# 22. Environment

Possible setting:

**Alien machine world**

Visual elements:

* strange rock formations;
* crystalline energy deposits;
* metallic terrain elements;
* abandoned technology;
* alien vegetation;
* ancient machine ruins.

The environment should remain visually simple and readable.

---

# 23. Art Direction

Style:

**Stylized 3D Low-Poly Sci-Fi**

Key principles:

* simple geometry;
* strong silhouettes;
* readable colors;
* minimal textures;
* flat/simple materials;
* controlled emissive effects;
* exaggerated proportions;
* soft shadows;
* visually distinct factions.

Units must remain identifiable from the default camera distance.

---

# 24. Factions

V1 contains mechanically identical factions.

Player faction and AI faction should use different accent colors.

Do not create separate technology trees.

Faction asymmetry is explicitly out of scope.

---

# 25. Camera

Use a fixed-angle RTS camera.

Preferred projection:

**Orthographic**

Alternative:

low-FOV perspective camera if orthographic creates technical problems.

Camera controls:

**ZQSD** — pan (AZERTY keyboard)

**Arrow keys** — pan

**Two-finger trackpad scroll** — pan

**Trackpad pinch** — zoom

Optional:

**Edge scrolling**

Camera rotation is not required.

Camera movement must remain constrained to map boundaries.

---

# 26. Selection Controls

## Single Selection

Left click.

## Box Selection

Left-click drag.

## Add to Selection

Shift + click.

## Control Groups

**Ctrl + 1–9** assigns.

**1–9** recalls.

Double-click selection of same unit type is optional.

---

# 27. Commands

Right click is contextual.

Terrain:

**Move**

Enemy:

**Attack**

Resource with Worker:

**Gather**

Construction site with Worker:

**Build**

Damaged friendly building with Worker:

**Repair**

Commands should produce immediate visual feedback at the clicked position.

---

# 28. Group Movement

Units receiving a group move command must not all target the exact same position.

Generate destination slots around the requested destination.

Goals:

* reduce stacking;
* improve readability;
* reduce collision/pathfinding congestion.

Complex military formations are not required.

---

# 29. Enemy AI

The enemy must be capable of playing a complete match without cheating as the default behavior.

The AI should:

* produce Workers;
* gather resources;
* construct infrastructure;
* maintain Agent Capacity;
* progress through Generations;
* produce military units;
* scout;
* defend;
* attack;
* rebuild after losses.

The AI does not need machine learning or an LLM.

It should be deterministic game AI running locally.

---

# 30. AI Architecture

Recommended architecture:

**Utility AI + finite strategic states**

High-level states:

### EXPAND_ECONOMY

Increase Workers and infrastructure.

### TECH

Prepare for Generation advancement.

### BUILD_ARMY

Produce military units.

### SCOUT

Locate enemy infrastructure.

### DEFEND

Respond to detected attacks.

### ATTACK

Assemble army and attack.

### RECOVER

Rebuild economy/military after heavy losses.

Strategic decisions should run at a relatively low frequency.

Example:

**2–4 decisions per second maximum**

Do not execute expensive AI planning every render frame.

---

# 31. AI Knowledge

The AI should preferably respect Fog of War.

It should remember previously discovered locations.

At minimum:

* discovered enemy Core position;
* known resource areas;
* last observed enemy military positions.

Perfect information may be temporarily used during development but should not be the intended final behavior.

---

# 32. Production Queues

Production buildings support queued units.

UI shows:

* unit type;
* remaining production time;
* queue order.

Multiple units may be queued.

Resources are deducted when added to the queue.

---

# 33. Rally Points

Production structures support rally points.

Newly created units automatically move toward the rally point.

Core rally points may target resources.

If a Worker is produced with a resource rally point, it should automatically begin gathering.

This is highly desirable because it reinforces the automation theme.

---

# 34. User Interface

The UI should be functional, minimal, and futuristic.

---

## Top Resource Bar

Always visible:

**Matter | Energy | Data | Agents**

Example:

**Matter 420 | Energy 215 | Data 80 | Agents 17/25**

---

## Selection Panel

Displays:

* selected entity name;
* icon;
* HP;
* current activity;
* relevant stats.

Example:

**WORKER AGENT**

42 / 50 HP

AUTOMATED: MATTER

---

## Action Panel

Context-sensitive actions.

Worker:

* build;
* automate resource collection;
* repair.

Core:

* Worker Agent;
* Generation Upgrade.

Fabricator:

* Striker.

Heavy Foundry:

* Titan.

---

# 35. Minimap

Priority: P1.

Display:

* explored terrain;
* friendly units;
* friendly buildings;
* visible enemy units;
* visible enemy buildings.

Clicking the minimap moves the camera.

---

# 36. Audio

Minimum sound set:

* UI interaction;
* unit selected;
* move command;
* Worker gathering;
* construction;
* laser fire;
* impact;
* explosion;
* building destruction;
* Generation advancement;
* Victory;
* Defeat.

Background music should be futuristic, atmospheric, and non-intrusive.

Audio must not block gameplay implementation.

---

# 37. Main Menu

Simple main menu.

Title:

**AGE OF AGENTS**

Primary actions:

**PLAY**

**HOW TO PLAY**

Optional:

**SETTINGS**

Play immediately starts a match against local AI.

No lobby.

No account.

No matchmaking.

---

# 38. End Screen

Display:

**VICTORY**

or

**DEFEAT**

Statistics:

* match duration;
* Matter collected;
* Energy collected;
* Data collected;
* Agents created;
* Agents destroyed;
* Agents lost;
* buildings constructed;
* buildings destroyed;
* final Generation.

Actions:

**PLAY AGAIN**

**MAIN MENU**

---

# 39. TECHNICAL ARCHITECTURE

## 39.1 Core Principles

V1 must be:

* local-first;
* backend-free;
* static deployable;
* deterministic where practical;
* data-driven;
* modular;
* performance-conscious;
* easy for an AI coding agent to understand and modify.

The browser runs the entire game simulation.

---

# 40. Recommended Technology Stack

## Language

**TypeScript**

Use strict TypeScript.

Avoid unnecessary `any`.

---

## Build Tool

**Vite**

Reasons:

* fast development server;
* simple TypeScript support;
* efficient production builds;
* straightforward static deployment.

---

## Rendering / Game Engine

Preferred:

**Three.js**

Use Three.js for:

* WebGL rendering;
* cameras;
* lighting;
* meshes;
* materials;
* animations;
* raycasting;
* visual effects.

Do not build rendering primitives from scratch.

If implementation reveals that a higher-level Three.js ecosystem library substantially simplifies a feature, it may be introduced, but avoid unnecessary dependencies.

---

# 41. UI Technology

Preferred:

**React + TypeScript**

React should handle:

* menus;
* HUD;
* selection panels;
* action buttons;
* production queues;
* end screen;
* settings.

Three.js handles the game world.

React should not render or manage every game entity.

Keep simulation state separate from React component state.

---

# 42. State Management

Recommended:

**Zustand**

Use Zustand primarily for UI-facing global state and game/application state that must be shared with React.

Do not push every per-frame entity transform through React/Zustand.

Simulation entities should remain inside the game simulation layer.

---

# 43. Styling

Recommended:

**CSS Modules or Tailwind CSS**

Choose whichever allows faster iteration.

Do not spend significant development time building a design system.

---

# 44. 3D Assets

Preferred format:

**glTF / GLB**

Advantages:

* efficient browser loading;
* native Three.js support;
* animations;
* compact binary format.

Low-poly models should be optimized before inclusion when practical.

---

# 45. Asset Strategy

Avoid depending on a large bespoke asset pipeline during the challenge.

Preferred priority:

1. reusable low-poly asset packs;
2. AI-generated concepts;
3. simple custom Blender models;
4. procedural primitives when appropriate.

Gameplay readability matters more than model complexity.

---

# 46. Physics

Do NOT introduce a full physics engine unless absolutely necessary.

RTS gameplay does not require realistic physics.

Use custom lightweight:

* spatial checks;
* collision circles;
* bounding boxes;
* navigation blockers.

---

# 47. Navigation and Pathfinding

Recommended approach:

**Grid-based navigation + A***

The world should expose a navigation grid.

Cells can be:

* walkable;
* blocked;
* temporarily occupied.

Buildings and major obstacles update navigation occupancy.

A* handles long-distance routing.

Units perform lightweight local avoidance around nearby units.

Do not run full A* every frame.

Cache paths when possible.

Recalculate only when:

* destination changes;
* path becomes invalid;
* unit becomes stuck.

---

# 48. Spatial Partitioning

Implement a lightweight spatial indexing system.

Recommended:

**Uniform spatial hash / grid**

Use it for:

* nearby enemy searches;
* collision queries;
* local avoidance;
* selection optimization;
* vision queries.

Avoid iterating through every entity for every entity.

---

# 49. Entity Architecture

Avoid over-engineering a full ECS unless implementation clearly benefits from one.

Recommended pragmatic model:

**Entity base + specialized components/systems**

Conceptual entities:

* Unit;
* Building;
* ResourceNode;
* Projectile.

Systems:

* MovementSystem;
* CombatSystem;
* GatheringSystem;
* ConstructionSystem;
* ProductionSystem;
* VisionSystem;
* AISystem.

Prefer composition over deep inheritance.

---

# 50. Simulation Loop

Rendering and simulation should be conceptually separated.

Recommended structure:

**requestAnimationFrame**

→ accumulate delta time

→ update simulation

→ update visual transforms

→ render

Important systems may run at different frequencies.

Example:

Movement:

60 Hz or frame-based.

Combat:

10–20 Hz where appropriate.

AI strategy:

2–4 Hz.

Fog of War:

5–10 Hz.

Target acquisition:

5–10 Hz.

This prevents unnecessary CPU usage.

---

# 51. Game Time

All gameplay timers must use simulation delta time.

Do not depend on raw frame counts.

Examples:

* attack cooldowns;
* construction;
* production;
* gathering;
* movement;
* AI timers.

---

# 52. Data-Driven Configuration

Gameplay values must live in centralized configuration files.

Example:

`src/data/units.ts`

`src/data/buildings.ts`

`src/data/resources.ts`

`src/data/technologies.ts`

Example unit configuration:

```ts
{
  id: "striker",
  maxHp: 120,
  attackDamage: 12,
  attackRange: 2.5,
  attackCooldown: 0.9,
  movementSpeed: 4,
  capacityCost: 1,
  cost: {
    matter: 60,
    energy: 20
  },
  productionTime: 8
}
```

Do not scatter balancing constants throughout implementation code.

---

# 53. Suggested Project Structure

```text
src/

  app/
    App.tsx
    routes/

  game/
    Game.ts
    GameLoop.ts
    GameState.ts

    camera/
    input/
    world/
    navigation/
    spatial/

    entities/
      units/
      buildings/
      resources/
      projectiles/

    systems/
      MovementSystem.ts
      CombatSystem.ts
      GatheringSystem.ts
      ConstructionSystem.ts
      ProductionSystem.ts
      VisionSystem.ts

    ai/
      AIController.ts
      EconomyAI.ts
      MilitaryAI.ts
      AIStrategy.ts

    rendering/
      Renderer.ts
      ModelManager.ts
      EffectsManager.ts

  data/
    units.ts
    buildings.ts
    technologies.ts
    balance.ts

  ui/
    hud/
    selection/
    actions/
    menus/
    minimap/

  assets/

  audio/

  utils/
```

The exact structure may evolve, but maintain strong separation between:

**simulation**

and

**presentation**

---

# 54. Input Architecture

Create a centralized InputManager.

It should translate raw browser input into game commands.

Example:

Mouse event

↓

InputManager

↓

Selection/Command system

↓

Game command

Do not place gameplay logic directly inside DOM event callbacks.

---

# 55. Command Architecture

Player actions should become explicit commands.

Examples:

```text
MoveCommand
AttackCommand
GatherCommand
BuildCommand
RepairCommand
AutomateCommand
```

This improves:

* debugging;
* AI integration;
* future multiplayer feasibility;
* replay possibilities;
* deterministic behavior.

AI should ideally use the same command interfaces as the human player.

---

# 56. Fog of War Implementation

Recommended V1 approach:

Grid-based visibility.

Maintain:

* explored grid;
* currently visible grid.

Friendly entities reveal cells inside their vision radius.

Rendering can use:

* texture mask;
* shader overlay;
* simplified tile overlay.

Choose the simplest performant implementation.

Do not sacrifice core gameplay to build sophisticated Fog of War shaders.

---

# 57. Save System

No traditional game saving is required.

Optional local settings may use:

**localStorage**

Potential later persistent data may use:

**IndexedDB**

No remote database.

---

# 58. Networking

None.

V1 must contain:

* no multiplayer;
* no WebSocket server;
* no authentication;
* no backend API;
* no matchmaking.

---

# 59. Deployment

Development runs locally.

Production output must be a static Vite build.

Target deployment:

**Cloudflare Pages**

The application must remain compatible with static hosting.

Expected architecture:

```text
Cloudflare CDN
      ↓
Static HTML / JS / CSS / GLB / Audio
      ↓
Browser
      ↓
Local Game Simulation
```

No gameplay server is required.

---

# 60. Future Cloud Architecture

Do not implement this in V1.

If the project later requires online functionality, potential Cloudflare services include:

* Workers;
* D1;
* Durable Objects;
* R2.

Potential future features:

* accounts;
* cloud saves;
* leaderboards;
* analytics;
* multiplayer;
* matchmaking;
* replay sharing.

The V1 architecture should avoid unnecessarily preventing these additions, but should not implement infrastructure for hypothetical future requirements.

---

# 61. Performance Targets

Target hardware:

normal modern desktop/laptop.

Browser targets:

* Chrome;
* Edge;
* Firefox.

Safari support is desirable but not a blocker during the challenge.

Target:

**60 FPS during normal gameplay**

Minimum acceptable:

**30 FPS during large battles**

Target entity scale:

**100–150 active units**

Potential stretch:

**200 units**

---

# 62. Performance Rules

Avoid allocations inside hot loops where practical.

Use object pooling for:

* projectiles;
* repeated effects;
* temporary combat visuals.

Do not perform:

* pathfinding for every unit every frame;
* global enemy searches every frame;
* AI strategy every frame;
* Fog of War recalculation every frame.

Use spatial partitioning.

Batch rendering when practical.

Consider Three.js InstancedMesh for repeated objects such as:

* resource nodes;
* environmental props;
* identical units if architecture permits.

Optimization should be driven by profiling rather than premature complexity.

---

# 63. Debug Tools

The development build should include a lightweight debug mode.

Useful toggles:

* FPS;
* entity count;
* navigation grid;
* paths;
* AI state;
* vision radius;
* Fog of War;
* spatial grid;
* resource values.

Possible keyboard shortcut:

**F3**

Debug tooling is valuable because an AI agent must be able to diagnose simulation behavior quickly.

---

# 64. Logging

Use structured logging categories.

Examples:

```text
[AI]
[NAV]
[COMBAT]
[ECONOMY]
[BUILD]
[PERF]
```

Avoid excessive production console spam.

---

# 65. Error Handling

The game should fail visibly during development.

Do not silently swallow simulation errors.

Development errors should provide enough context to identify:

* entity;
* system;
* command;
* state.

---

# 66. Testing Strategy

Prioritize gameplay integration tests over exhaustive unit tests during the challenge.

High-value tests:

* resources cannot become negative;
* production respects costs;
* capacity limits work;
* destroyed entities cannot receive commands;
* Core destruction triggers match end;
* workers correctly return resources;
* AI can recover from depleted resources;
* pathfinding returns valid paths;
* generation requirements are enforced.

Use automated tests for deterministic pure logic where inexpensive.

---

# 67. Development Philosophy for the AI Agent

The project is constrained to seven days.

The implementation agent must optimize for:

**a complete game, not perfect architecture.**

Rules:

1. Build the smallest working version first.
2. Keep the project runnable at all times.
3. Integrate continuously.
4. Avoid speculative abstractions.
5. Avoid rewriting working systems unless necessary.
6. Prefer proven libraries.
7. Profile before optimizing.
8. Keep gameplay configuration data-driven.
9. Prioritize P0 over visual polish.
10. Cut features aggressively if the core loop is threatened.

---

# 68. Priority Levels

## P0 — SHIP OR FAIL

Required:

* Three.js world;
* RTS camera;
* map;
* selection;
* group selection;
* unit movement;
* pathfinding;
* Worker Agents;
* Matter;
* Energy;
* gathering;
* Core;
* Relay Node;
* construction;
* Agent Capacity;
* Fabricator;
* Striker;
* production queues;
* combat;
* building destruction;
* enemy AI economy;
* enemy AI military production;
* enemy attack behavior;
* Victory;
* Defeat;
* complete playable match;
* static production build.

---

## P1 — TARGET

Strongly desired:

* Data;
* Generation system;
* Ranger;
* Scout Drone;
* Titan;
* Defense Turret;
* Fog of War;
* automation commands;
* rally points;
* sound;
* end-game statistics;
* better visual effects;
* procedural resource placement.

---

## P2 — POLISH / STRETCH

Optional:

* minimap;
* Research Array;
* upgrades;
* advanced military automation;
* procedural terrain;
* advanced AI;
* building visual evolution;
* elaborate animations;
* environment animation;
* additional effects;
* voice lines;
* Singularity alternate victory condition.

---

# 69. Explicitly Out of Scope

Do not implement during the 7-day challenge:

* multiplayer;
* accounts;
* backend;
* matchmaking;
* cloud saves;
* multiple factions;
* campaign;
* missions;
* heroes;
* inventory;
* loot;
* diplomacy;
* trading;
* naval gameplay;
* complex physics;
* destructible terrain;
* weather;
* day/night cycle;
* map editor;
* mod support;
* mobile support;
* controller support;
* complex formations;
* sophisticated replay system;
* advanced procedural worlds.

---

# 70. Seven-Day Development Plan

## DAY 1 — THE WORLD

Goal:

**Make it feel like an RTS.**

Implement:

* project setup;
* Three.js renderer;
* camera;
* terrain;
* input;
* selection;
* box selection;
* spawning units;
* movement;
* navigation;
* basic low-poly placeholder assets.

End-of-day test:

> Select 30 robots and successfully move them around obstacles.

---

## DAY 2 — THE MACHINE ECONOMY

Goal:

**Make resources matter.**

Implement:

* Worker Agent;
* Matter;
* Energy;
* resource extraction;
* carrying;
* depositing;
* Core;
* resource UI;
* Agent Capacity;
* Worker production.

End-of-day test:

> Start with three Workers and grow the economy without debug commands.

---

## DAY 3 — BUILD THE COLONY

Goal:

**Turn an economy into a base.**

Implement:

* building placement;
* construction;
* Relay Node;
* Fabricator;
* production queues;
* rally points if possible;
* economic automation.

End-of-day test:

> Build a functional machine colony from the starting Core.

---

## DAY 4 — WAR

Goal:

**Make robots kill robots.**

Implement:

* Striker;
* Ranger if possible;
* targeting;
* combat;
* health;
* projectiles;
* lasers;
* deaths;
* building damage;
* Core destruction.

End-of-day test:

> Two independently controlled armies can fight until one side is destroyed.

---

## DAY 5 — THE OTHER INTELLIGENCE

Goal:

**Create an opponent capable of winning.**

Implement:

* AI economy;
* AI Worker production;
* AI construction;
* AI Agent Capacity management;
* AI military production;
* scouting;
* defense;
* attacks;
* recovery behavior.

End-of-day test:

> Start a match and do nothing. The AI eventually finds and destroys the player's Core.

---

## DAY 6 — EVOLUTION

Goal:

**Turn the prototype into Age of Agents.**

Implement highest-value P1 features:

* Data;
* Generation progression;
* Fog of War;
* Scout Drone;
* Titan;
* Defense Turret;
* visual evolution;
* sound;
* UI improvements.

End-of-day test:

> An external tester can play from Awakening through Singularity and finish a match.

---

## DAY 7 — SURVIVE

Goal:

**Ship.**

Feature freeze.

Focus exclusively on:

* bugs;
* stuck units;
* pathfinding;
* performance;
* AI failures;
* balancing;
* UX;
* visual feedback;
* asset loading;
* production build;
* browser testing.

Do not begin major new features.

End-of-day test:

> Open production build in a clean browser and play a complete match without developer tools.

---

# 71. Definition of Done

Age of Agents V1 is complete when a new player can:

```text
Open game
    ↓
Start match
    ↓
Select Worker Agents
    ↓
Gather Matter and Energy
    ↓
Produce additional Workers
    ↓
Build Relay Nodes
    ↓
Build a Fabricator
    ↓
Produce combat Agents
    ↓
Automate parts of the economy
    ↓
Explore the battlefield
    ↓
Discover the enemy
    ↓
Build an army
    ↓
Fight enemy Agents
    ↓
Attack the enemy colony
    ↓
Destroy the enemy Core
    ↓
VICTORY
```

This entire flow must work without:

* backend;
* developer console;
* debug commands;
* manual state manipulation.

---

# 72. Success Criteria

The challenge is considered successful if:

1. the game runs locally in a browser;
2. a complete match can be played;
3. the enemy AI can independently develop and attack;
4. economy, construction, production, and combat form one coherent loop;
5. the visual presentation clearly communicates a futuristic low-poly robot RTS;
6. performance remains acceptable during normal matches;
7. the production build can be deployed as static files;
8. the project can be uploaded to Cloudflare Pages without requiring backend infrastructure.

Visual polish is secondary.

Completeness is mandatory.

---

# 73. Agent Execution Instructions

The AI development agent should treat this document as the product authority.

When implementation choices are ambiguous:

**choose the simplest solution that preserves the intended player experience.**

Do not request product clarification for minor implementation details.

Make reasonable engineering decisions and document them.

If a feature threatens the seven-day deadline:

1. simplify it;
2. downgrade it;
3. remove P2 functionality;
4. remove P1 functionality if necessary;
5. never sacrifice the complete P0 gameplay loop.

Maintain a living file:

`PROJECT_STATUS.md`

It should contain:

* current milestone;
* completed systems;
* known bugs;
* technical debt;
* next priorities;
* deferred features;
* important architectural decisions.

Maintain another file:

`AGENT_HANDOFF.md`

It should explain:

* how to run the project;
* architecture;
* important systems;
* conventions;
* debugging tools;
* known limitations.

Update both throughout development.

---

# 74. Final Product Principle

At all times, optimize for this question:

> "If development stopped right now, how close are we to having a game someone can actually play?"

The goal of the challenge is not to demonstrate how much code an AI can generate.

The goal is to prove that an AI can take a product specification and turn it into a coherent, playable game in seven days.

**AGE OF AGENTS**

**BUILD. AUTOMATE. EVOLVE. CONQUER.**
