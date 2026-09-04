import { AI, type AITuning } from '../../data/ai';
import { BUILDINGS } from '../../data/buildings';
import { UNITS } from '../../data/units';
import { validatePlacement, type PlaceableBuildingType } from '../building/PlacementController';
import type { Random } from '../util/Random';
import type { BuildingEntity, UnitEntity, Vec2 } from '../types/simulation';
import type { AICommands, AIView } from './AIContext';
import type { AISnapshot, AIState } from './AIStrategy';
import type { OpeningPlan } from './OpeningPlan';
import { distance } from './AIKnowledge';

interface Backoff { failures: number; until: number }

/**
 * Chooses what to build and where. Placement candidates are scored on a ring around the Core so
 * sites stay defended without walling the base in, and repeated failures back the type off.
 */
export class BuildPlanner {
  private readonly backoff = new Map<PlaceableBuildingType, Backoff>();
  private lastPlacement: Vec2 | null = null;

  private openingIndex = 0;

  constructor(
    private readonly random: Random,
    private readonly tuning: AITuning,
    private readonly plan: OpeningPlan,
  ) {}

  get lastSite(): Vec2 | null { return this.lastPlacement; }

  update(view: AIView, commands: AICommands, snapshot: AISnapshot, state: AIState): void {
    this.reviveStalledSites(view, commands);
    // Only a base under attack stops building. A colony whose army is out on a raid should still
    // be laying foundations -- pausing construction for the whole of every assault was most of
    // why the opponent's base stayed a Core and two sheds.
    if (state === 'DEFEND') return;
    const type = this.desiredBuilding(view, snapshot);
    if (!type || this.isBackedOff(type, snapshot.elapsedSeconds)) return;
    const cost = BUILDINGS[type].cost;
    const balances = view.balances();
    // Once the army is the bottleneck (a producer is up and the force is still short), a
    // non-defense build must not spend the Matter the next Striker needs. With flush-adjacent
    // placement newly possible the planner could otherwise relay-spam its income away and
    // freeze the assault for minutes; the reserve keeps production fed while still expanding
    // whenever income covers both.
    // Walls are cheap enough to never contend with the army budget; everything else, Turrets
    // included, waits behind it. The colony fills out with whatever income is left over, which is
    // what stops a long build list from quietly replace production and stalling the next assault.
    const armyStarved = type !== 'wall' && snapshot.fabricators > 0
      && snapshot.army < this.tuning.attackForce;
    const reserveMatter = armyStarved ? (UNITS.striker.cost.matter ?? 0) * AI.armyReserveStrikers : 0;
    if (balances.matter < (cost.matter ?? 0) + reserveMatter) return;
    if (balances.energy < ('energy' in cost ? cost.energy ?? 0 : 0)) return;
    this.place(view, commands, snapshot, type);
  }

  /** A Worker pulled off construction leaves the site stalled; give it a new builder. */
  private reviveStalledSites(view: AIView, commands: AICommands): void {
    const sites = view.buildings().filter((building) => !building.operational);
    if (sites.length === 0) return;
    const units = view.units();
    for (const site of sites) {
      const builder = site.builderId ? units.find((unit) => unit.id === site.builderId) : undefined;
      if (builder?.buildOrder?.buildingId === site.id) continue;
      const replacement = nearestFreeWorker(units, site.position);
      if (replacement) commands.assignBuilder(replacement, site);
    }
  }

  /**
   * What to build next. The order is: keep the opening plan's first few structures, never run out
   * of capacity, get a producer up, fortify, then fill the colony out.
   *
   * The last step is what makes the base look like a base. Previously the plan ran dry after a
   * Fabricator and two Relays, so an opponent that had been mining for twenty minutes still had
   * four buildings and no defences.
   */
  private desiredBuilding(view: AIView, snapshot: AISnapshot): PlaceableBuildingType | null {
    if (snapshot.constructionSites >= AI.concurrentSites) return null;
    const buildings = view.buildings();
    const count = (kind: PlaceableBuildingType): number => buildings.filter((building) => building.kind === kind).length;
    const capacityFree = snapshot.capacityMax - snapshot.capacityUsed - snapshot.capacityReserved;
    const generation = view.generation();
    const matter = view.balances().matter;

    // The opening plan's own build order comes first, one structure at a time.
    const opening = this.plan.buildOrder[this.openingIndex];
    if (opening) {
      const unlocked = opening !== 'turret' || generation >= 2;
      if (unlocked) return opening;
      this.openingIndex += 1;
    }

    if (capacityFree <= AI.capacityHeadroom) {
      if (count('relay') < this.tuning.maxRelays) return 'relay';
      if (count('habitat') < AI.maxHabitats) return 'habitat';
    }
    if (snapshot.fabricators < 1) return 'fabricator';

    // Manufactured resources, once the ground nearby is stripped. A colony whose Matter or Data
    // is gone stops being able to build or evolve at all, and a plant is the only way back.
    if (generation >= 2) {
      const plant = this.desiredPlant(view, count);
      if (plant) return plant;
    }

    // The Foundry is the Generation III unlock and the only way to a Titan, so it outranks any
    // amount of fortification once it is available.
    if (generation >= 3 && count('foundry') === 0) return 'foundry';
    // Otherwise fortify before massing: a colony with no Turrets loses its Workers to the first raid.
    const turrets = count('turret');
    if (generation >= 2 && turrets < this.plan.earlyTurrets && matter > 180) return 'turret';
    if (generation >= 2 && turrets < AI.maxTurrets && matter > 260) return 'turret';

    if (snapshot.fabricators < AI.maxFabricators && matter > 260) return 'fabricator';
    // Turrets need Generation II. A colony that has not got there yet still needs something
    // between a raid and its Workers, so it fences the approach.
    if (count('wall') < AI.maxWalls && matter > 90) return 'wall';
    if (count('depot') < AI.maxDepots && matter > 200) return 'depot';
    if (count('habitat') < AI.maxHabitats && matter > 220) return 'habitat';
    if (count('relay') < this.tuning.maxRelays && capacityFree <= AI.capacityHeadroom * 2) return 'relay';
    return null;
  }

  /**
   * A plant, but only for a resource the colony can no longer mine. Synthesis is a loss, so the
   * opponent builds one exactly when a human would: when the alternative is nothing at all.
   */
  private desiredPlant(view: AIView, count: (kind: PlaceableBuildingType) => number): PlaceableBuildingType | null {
    const core = view.core();
    if (!core) return null;
    const exhausted = (type: 'matter' | 'energy' | 'data'): boolean => !view.resources().some((node) =>
      node.alive && node.resourceType === type && distance(node.position, core.position) <= AI.synthesisSearchRange);
    // Data first: it is the scarcest thing on the map and the only route to Generation III.
    if (exhausted('data') && !exhausted('energy') && count('datalab') < AI.maxPlants) return 'datalab';
    if (exhausted('matter') && !exhausted('energy') && count('reclaimer') < AI.maxPlants) return 'reclaimer';
    return null;
  }

  private place(view: AIView, commands: AICommands, snapshot: AISnapshot, type: PlaceableBuildingType): void {
    const core = view.core();
    if (!core) return;
    const position = this.findSite(view, core, type);
    if (!position) return this.recordFailure(type, snapshot.elapsedSeconds);
    const worker = nearestFreeWorker(view.units(), position);
    if (!worker) return;
    const result = commands.build(worker, type, position);
    if (result.ok) {
      this.backoff.delete(type);
      this.lastPlacement = position;
      if (this.plan.buildOrder[this.openingIndex] === type) this.openingIndex += 1;
      return;
    }
    if (result.reason !== 'INSUFFICIENT_RESOURCES') this.recordFailure(type, snapshot.elapsedSeconds);
  }

  private findSite(view: AIView, core: BuildingEntity, type: PlaceableBuildingType): Vec2 | null {
    const buildings = view.buildings();
    // Turrets and walls cover the way in. Everything else fills the ring behind them.
    const facing = type === 'turret' || type === 'wall';
    const towards = facing ? Math.atan2(-core.position.z, -core.position.x) : null;
    let best: { position: Vec2; score: number } | null = null;
    for (let attempt = 0; attempt < AI.placementCandidates; attempt += 1) {
      const angle = towards === null
        ? this.random.next() * Math.PI * 2
        : towards + this.random.range(-AI.turretArc, AI.turretArc);
      const radius = facing
        ? this.random.range(AI.buildRingMax * 0.8, AI.buildRingMax * 1.35)
        : this.random.range(AI.buildRingMin, AI.buildRingMax);
      const candidate = { x: core.position.x + Math.cos(angle) * radius, z: core.position.z + Math.sin(angle) * radius };
      const placement = validatePlacement(type, candidate, view.navigation, view.allBuildings(), view.resources());
      if (!placement.valid) continue;
      // Prefer sites close to the Core but not crowding structures that are already there.
      const crowding = Math.min(...buildings.map((building) => distance(building.position, placement.position)), 99);
      const score = -distance(core.position, placement.position) + Math.min(crowding, 8) * 1.5;
      if (!best || score > best.score) best = { position: placement.position, score };
    }
    return best?.position ?? null;
  }

  private recordFailure(type: PlaceableBuildingType, elapsedSeconds: number): void {
    const entry = this.backoff.get(type) ?? { failures: 0, until: 0 };
    entry.failures += 1;
    if (entry.failures >= AI.placementFailureLimit) {
      entry.failures = 0;
      entry.until = elapsedSeconds + AI.placementBackoffSeconds;
    }
    this.backoff.set(type, entry);
  }

  private isBackedOff(type: PlaceableBuildingType, elapsedSeconds: number): boolean {
    return elapsedSeconds < (this.backoff.get(type)?.until ?? 0);
  }
}

export function nearestFreeWorker(units: readonly UnitEntity[], target: Vec2): UnitEntity | undefined {
  return units
    .filter((unit) => unit.kind === 'worker' && unit.alive && !unit.buildOrder)
    .sort((a, b) => distance(a.position, target) - distance(b.position, target) || a.id.localeCompare(b.id))[0];
}
