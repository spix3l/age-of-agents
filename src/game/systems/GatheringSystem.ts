import { RESOURCES } from '../../data/resources';
import type { EntityRegistry } from '../entities/core/EntityRegistry';
import { extractResource, type ResourceNodeEntity } from '../entities/resources/ResourceNode';
import type { EconomyLedger } from '../economy/EconomyLedger';
import { findPath } from '../navigation/AStar';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import type { BuildingEntity, UnitEntity, Vec2 } from '../types/simulation';

export const WORKER_CARGO_CAPACITY = 10;

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
      if (worker.destination === null) {
        order.state = 'extracting';
        order.workSeconds = 0;
      }
      return;
    }

    if (order.state === 'extracting') {
      if (!node?.alive) return worker.cargo.amount > 0 ? this.returnToCore(worker) : this.idle(worker);
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
      if (worker.destination === null) {
        order.state = 'depositing';
        order.workSeconds = 0;
      }
      return;
    }

    const ledger = this.ledgerForTeam(worker.team);
    if (ledger && worker.cargo.type && worker.cargo.amount > 0) ledger.deposit(worker.cargo.type, worker.cargo.amount);
    worker.cargo.type = null;
    worker.cargo.amount = 0;
    if (node?.alive) this.moveToNode(worker, node);
    else this.idle(worker);
  }

  private returnToCore(worker: UnitEntity): void {
    const core = this.buildings.alive().find((building) => building.team === worker.team && building.acceptsDeposits);
    if (!core) return this.idle(worker);
    this.setPath(worker, this.approachPoint(core.position, worker.position, Math.max(core.footprint.x, core.footprint.z) / 2 + 1));
    if (!worker.gatherOrder) return;
    worker.gatherOrder.state = 'returning';
    worker.activity = 'Returning cargo';
  }

  private moveToNode(worker: UnitEntity, node: ResourceNodeEntity): void {
    this.setPath(worker, node.position);
    if (!worker.gatherOrder) return;
    worker.gatherOrder.state = 'moving-to-node';
    worker.activity = `Gathering ${node.resourceType === 'matter' ? 'Matter' : 'Energy'}`;
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
