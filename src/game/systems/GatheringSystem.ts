import { RESOURCES } from '../../data/resources';
import type { EntityRegistry } from '../entities/core/EntityRegistry';
import { extractResource, type ResourceNodeEntity } from '../entities/resources/ResourceNode';
import type { EconomyLedger } from '../economy/EconomyLedger';
import { findPath } from '../navigation/AStar';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import type { BuildingEntity, UnitEntity, Vec2 } from '../types/simulation';

function distance(a: Vec2, b: Vec2): number { return Math.hypot(a.x - b.x, a.z - b.z); }

export const WORKER_CARGO_CAPACITY = 10;
/** How close a Worker must actually be before a travel leg counts as finished. */
export const ARRIVAL_RADIUS = 2.4;
/** Deposits are drawn as a cluster roughly this wide. */
const NODE_RADIUS = 1.6;

/**
 * The cell a Worker can actually harvest a node from, or null when terrain+padding keep every
 * walkable cell outside extraction range (e.g. a node that spawned against a ridge). Without
 * this check a node whose approach cell sits beyond the extraction range traps automation
 * workers in an endless walk-stop-repath loop that starves the whole economy.
 */
export function gatherApproachCell(grid: NavigationGrid, node: ResourceNodeEntity): Vec2 | null {
  const cell = grid.findNearestWalkable(node.position);
  if (!cell) return null;
  const world = grid.cellToWorld(cell);
  return distance(world, node.position) <= ARRIVAL_RADIUS + NODE_RADIUS ? world : null;
}

export class GatheringSystem {
  constructor(
    private readonly resources: EntityRegistry<ResourceNodeEntity>,
    private readonly buildings: EntityRegistry<BuildingEntity>,
    private readonly ledgerForTeam: (team: UnitEntity['team']) => EconomyLedger | undefined,
    private readonly grid: NavigationGrid,
  ) {}

  update(workers: readonly UnitEntity[], delta: number): void {
    for (const worker of workers) this.updateWorker(worker, delta);
  }

  private updateWorker(worker: UnitEntity, delta: number): void {
    const order = worker.gatherOrder;
    if (!worker.alive || !order) return;
    const node = this.resources.get(order.resourceId);

    if (order.state === 'moving-to-node') {
      if (!node?.alive && worker.cargo.amount === 0) return this.idle(worker);
      if (worker.destination !== null || !node) return;
      // Arriving is a distance test, not just "the path ended": combat or a blocked path can
      // clear a destination early, and the Worker must resume the trip instead of mining air.
      if (distance(worker.position, node.position) <= ARRIVAL_RADIUS + NODE_RADIUS) {
        order.state = 'extracting';
        order.workSeconds = 0;
        return;
      }
      this.moveToNode(worker, node);
      return;
    }

    if (order.state === 'extracting') {
      if (!node?.alive) return worker.cargo.amount > 0 ? this.returnToCore(worker) : this.idle(worker);
      if (distance(worker.position, node.position) > ARRIVAL_RADIUS + NODE_RADIUS + 1) return this.moveToNode(worker, node);
      order.workSeconds += delta;
      const config = RESOURCES[node.resourceType];
      if (order.workSeconds < config.harvestSeconds) return;
      order.workSeconds = 0;
      const space = WORKER_CARGO_CAPACITY - worker.cargo.amount;
      const extracted = extractResource(node, Math.min(config.harvestAmount, space));
      worker.cargo.type = node.resourceType;
      worker.cargo.amount += extracted;
      if (worker.cargo.amount >= WORKER_CARGO_CAPACITY || !node.alive) this.returnToCore(worker);
      return;
    }

    if (order.state === 'returning') {
      if (worker.destination !== null) return;
      const depot = this.depotFor(worker);
      if (!depot) return this.idle(worker);
      const reach = ARRIVAL_RADIUS + Math.max(depot.footprint.x, depot.footprint.z) / 2;
      if (distance(worker.position, depot.position) <= reach) {
        order.state = 'depositing';
        order.workSeconds = 0;
        return;
      }
      this.returnToCore(worker);
      return;
    }

    const ledger = this.ledgerForTeam(worker.team);
    if (ledger && worker.cargo.type && worker.cargo.amount > 0) ledger.deposit(worker.cargo.type, worker.cargo.amount);
    worker.cargo.type = null;
    worker.cargo.amount = 0;
    if (node?.alive) this.moveToNode(worker, node);
    else this.idle(worker);
  }

  private depotFor(worker: UnitEntity): BuildingEntity | undefined {
    return this.buildings.alive()
      .filter((building) => building.team === worker.team && building.acceptsDeposits && building.operational)
      .sort((a, b) => distance(a.position, worker.position) - distance(b.position, worker.position) || a.id.localeCompare(b.id))[0];
  }

  private returnToCore(worker: UnitEntity): void {
    const core = this.depotFor(worker);
    if (!core) return this.idle(worker);
    this.setPath(worker, this.approachPoint(core.position, worker.position, Math.max(core.footprint.x, core.footprint.z) / 2 + 1));
    if (!worker.gatherOrder) return;
    worker.gatherOrder.state = 'returning';
    worker.activity = 'Returning cargo';
  }

  private moveToNode(worker: UnitEntity, node: ResourceNodeEntity): void {
    const approach = gatherApproachCell(this.grid, node);
    if (!approach) {
      // Unharvestable node (terrain keeps every approach outside extraction range): release
      // the order so automation can pick a different node on its next search.
      return this.idle(worker);
    }
    this.setPath(worker, approach);
    if (!worker.gatherOrder) return;
    worker.gatherOrder.state = 'moving-to-node';
    worker.activity = `Gathering ${node.resourceType === 'matter' ? 'Matter' : node.resourceType === 'energy' ? 'Energy' : 'Data'}`;
  }

  private setPath(worker: UnitEntity, target: Vec2): void {
    const cell = this.grid.findNearestWalkable(target);
    const destination = cell ? this.grid.cellToWorld(cell) : target;
    const path = findPath(this.grid, worker.position, destination);
    if (path.length === 0) return this.idle(worker);
    worker.path = path;
    worker.pathIndex = path.length > 1 ? 1 : 0;
    worker.destination = destination;
    worker.stuckSeconds = 0;
    worker.repathCount = 0;
  }

  private approachPoint(target: Vec2, from: Vec2, distance: number): Vec2 {
    const dx = from.x - target.x;
    const dz = from.z - target.z;
    const length = Math.hypot(dx, dz) || 1;
    return { x: target.x + (dx / length) * distance, z: target.z + (dz / length) * distance };
  }

  private idle(worker: UnitEntity): void {
    worker.gatherOrder = null;
    worker.destination = null;
    worker.path = [];
    worker.pathIndex = 0;
    worker.activity = 'Idle';
  }
}
