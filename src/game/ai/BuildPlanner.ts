import { AI } from '../../data/ai';
import { BUILDINGS } from '../../data/buildings';
import { validatePlacement, type PlaceableBuildingType } from '../building/PlacementController';
import type { Random } from '../util/Random';
import type { BuildingEntity, UnitEntity, Vec2 } from '../types/simulation';
import type { AICommands, AIView } from './AIContext';
import type { AISnapshot, AIState } from './AIStrategy';
import { distance } from './AIKnowledge';

interface Backoff { failures: number; until: number }

/**
 * Chooses what to build and where. Placement candidates are scored on a ring around the Core so
 * sites stay defended without walling the base in, and repeated failures back the type off.
 */
export class BuildPlanner {
  private readonly backoff = new Map<PlaceableBuildingType, Backoff>();
  private lastPlacement: Vec2 | null = null;

  constructor(private readonly random: Random) {}

  get lastSite(): Vec2 | null { return this.lastPlacement; }

  update(view: AIView, commands: AICommands, snapshot: AISnapshot, state: AIState): void {
    this.reviveStalledSites(view, commands);
    if (state === 'DEFEND' || state === 'ATTACK') return;
    const type = this.desiredBuilding(view, snapshot);
    if (!type || this.isBackedOff(type, snapshot.elapsedSeconds)) return;
    const cost = BUILDINGS[type].cost;
    const balances = view.balances();
    if (balances.matter < (cost.matter ?? 0) || balances.energy < (cost.energy ?? 0)) return;
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

  private desiredBuilding(view: AIView, snapshot: AISnapshot): PlaceableBuildingType | null {
    if (snapshot.constructionSites > 0) return null;
    const capacityFree = snapshot.capacityMax - snapshot.capacityUsed - snapshot.capacityReserved;
    if (capacityFree <= AI.capacityHeadroom && snapshot.relays < AI.maxRelays) return 'relay';
    if (snapshot.fabricators < 1) return 'fabricator';
    if (snapshot.fabricators < AI.maxFabricators && view.balances().matter > 260) return 'fabricator';
    if (snapshot.relays < AI.maxRelays && capacityFree <= AI.capacityHeadroom * 2) return 'relay';
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
      return;
    }
    if (result.reason !== 'INSUFFICIENT_RESOURCES') this.recordFailure(type, snapshot.elapsedSeconds);
  }

  private findSite(view: AIView, core: BuildingEntity, type: PlaceableBuildingType): Vec2 | null {
    const buildings = view.buildings();
    let best: { position: Vec2; score: number } | null = null;
    for (let attempt = 0; attempt < AI.placementCandidates; attempt += 1) {
      const angle = this.random.next() * Math.PI * 2;
      const radius = this.random.range(AI.buildRingMin, AI.buildRingMax);
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
