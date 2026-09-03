import { BUILDINGS } from '../../data/buildings';
import type { EntityRegistry } from '../entities/core/EntityRegistry';
import { findPath } from '../navigation/AStar';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import type { BuildingEntity, ResourceCost, ResourceType, UnitEntity, Vec2 } from '../types/simulation';

export const CONSTRUCTION_REFUND_RATIO = 0.75;

export class ConstructionSystem {
  constructor(
    private readonly buildings: EntityRegistry<BuildingEntity>,
    private readonly grid: NavigationGrid,
    private readonly onComplete: (building: BuildingEntity) => void,
  ) {}

  assign(worker: UnitEntity, site: BuildingEntity): boolean {
    if (!worker.alive || worker.kind !== 'worker' || !site.alive || site.operational) return false;
    this.releasePreviousSite(worker);
    const target = this.approachPoint(site, worker.position);
    const cell = this.grid.findNearestWalkable(target, 8);
    if (!cell) return false;
    const destination = this.grid.cellToWorld(cell);
    const path = findPath(this.grid, worker.position, destination);
    if (path.length === 0) return false;
    worker.gatherOrder = null;
    worker.automation = null;
    worker.buildOrder = { buildingId: site.id };
    worker.path = path;
    worker.pathIndex = path.length > 1 ? 1 : 0;
    worker.destination = destination;
    worker.activity = 'Building';
    site.builderId = worker.id;
    return true;
  }

  update(workers: readonly UnitEntity[], delta: number): void {
    for (const worker of workers) {
      if (!worker.buildOrder) continue;
      const site = this.buildings.get(worker.buildOrder.buildingId);
      if (!site?.alive || site.operational || site.builderId !== worker.id) { this.clearWorker(worker); continue; }
      if (worker.destination !== null) continue;
      site.constructionProgress = Math.min(1, site.constructionProgress + delta / site.constructionTime);
      site.hp = Math.max(1, Math.round(site.maxHp * (0.05 + site.constructionProgress * 0.95)));
      if (site.constructionProgress < 1) continue;
      site.operational = true;
      site.hp = site.maxHp;
      this.clearWorker(worker);
      this.onComplete(site);
      // A player who drags out a wall run places many sites with one Worker. Rolling onto the
      // next unclaimed site is what turns that gesture into a built wall instead of one finished
      // segment and a row of foundations nobody ever returns to.
      this.claimNextSite(worker);
    }
    this.adoptOrphanedSites(workers);
  }

  /**
   * Sites whose builder has wandered off -- reassigned to a newer site, or pulled onto a gather
   * order -- are handed to a free Worker. Without this a stale `builderId` leaves a foundation
   * that can never be finished and never be cleaned up.
   */
  private adoptOrphanedSites(workers: readonly UnitEntity[]): void {
    const sites = this.buildings.alive().filter((building) => !building.operational);
    if (sites.length === 0) return;
    for (const site of sites) {
      const builder = site.builderId ? workers.find((worker) => worker.id === site.builderId) : undefined;
      if (builder?.alive && builder.buildOrder?.buildingId === site.id) continue;
      site.builderId = null;
      const free = this.nearestFreeWorker(workers, site);
      if (free) this.assign(free, site);
    }
  }

  /** The nearest idle Worker of the site's own faction, if there is one to spare. */
  private nearestFreeWorker(workers: readonly UnitEntity[], site: BuildingEntity): UnitEntity | undefined {
    return workers
      .filter((worker) => worker.alive && worker.kind === 'worker' && worker.team === site.team
        && !worker.buildOrder && !worker.gatherOrder && !worker.automation && worker.destination === null)
      .sort((a, b) => distanceTo(a.position, site.position) - distanceTo(b.position, site.position)
        || a.id.localeCompare(b.id))[0];
  }

  /** After finishing, take the closest unclaimed site of the same faction. */
  private claimNextSite(worker: UnitEntity): void {
    const next = this.buildings.alive()
      .filter((building) => !building.operational && building.team === worker.team && !building.builderId)
      .sort((a, b) => distanceTo(a.position, worker.position) - distanceTo(b.position, worker.position)
        || a.id.localeCompare(b.id))[0];
    if (next) this.assign(worker, next);
  }

  /** Releases the site a Worker was building before it is pointed at a new one. */
  private releasePreviousSite(worker: UnitEntity): void {
    const previousId = worker.buildOrder?.buildingId;
    if (!previousId) return;
    const previous = this.buildings.get(previousId);
    if (previous && previous.builderId === worker.id) previous.builderId = null;
  }

  private approachPoint(site: BuildingEntity, from: Vec2): Vec2 {
    const dx = from.x - site.position.x;
    const dz = from.z - site.position.z;
    const length = Math.hypot(dx, dz) || 1;
    const distance = Math.max(site.footprint.x, site.footprint.z) / 2 + 1;
    return { x: site.position.x + (dx / length) * distance, z: site.position.z + (dz / length) * distance };
  }

  private clearWorker(worker: UnitEntity): void {
    worker.buildOrder = null;
    worker.activity = 'Idle';
    worker.path = [];
    worker.pathIndex = 0;
    worker.destination = null;
  }
}

function distanceTo(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function constructionRefund(site: BuildingEntity): ResourceCost {
  const refund: Partial<Record<ResourceType, number>> = {};
  for (const [type, amount] of Object.entries(BUILDINGS[site.kind].cost) as [ResourceType, number][]) {
    refund[type] = Math.floor(amount * CONSTRUCTION_REFUND_RATIO);
  }
  return refund;
}
