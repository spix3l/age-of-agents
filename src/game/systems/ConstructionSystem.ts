import { BUILDINGS } from '../../data/buildings';
import type { EntityRegistry } from '../entities/core/EntityRegistry';
import { findPath } from '../navigation/AStar';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import type { BuildingEntity, UnitEntity, Vec2 } from '../types/simulation';

export const CONSTRUCTION_REFUND_RATIO = 0.75;

export class ConstructionSystem {
  constructor(
    private readonly buildings: EntityRegistry<BuildingEntity>,
    private readonly grid: NavigationGrid,
    private readonly onComplete: (building: BuildingEntity) => void,
  ) {}

  assign(worker: UnitEntity, site: BuildingEntity): boolean {
    if (!worker.alive || worker.kind !== 'worker' || !site.alive || site.operational) return false;
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
    }
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

export function constructionRefund(site: BuildingEntity): Readonly<Record<'matter' | 'energy', number>> {
  const cost = BUILDINGS[site.kind].cost as Readonly<Partial<Record<'matter' | 'energy', number>>>;
  return {
    matter: Math.floor((cost.matter ?? 0) * CONSTRUCTION_REFUND_RATIO),
    energy: Math.floor((cost.energy ?? 0) * CONSTRUCTION_REFUND_RATIO),
  };
}
