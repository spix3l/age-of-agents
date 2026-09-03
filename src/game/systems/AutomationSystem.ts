import { issueGatherCommand } from '../commands/GatherCommand';
import type { EntityRegistry } from '../entities/core/EntityRegistry';
import type { ResourceNodeEntity } from '../entities/resources/ResourceNode';
import { findPath } from '../navigation/AStar';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import type { UnitEntity } from '../types/simulation';

export const AUTOMATION_SEARCH_INTERVAL = 0.5;

export class AutomationSystem {
  constructor(private readonly resources: EntityRegistry<ResourceNodeEntity>, private readonly grid: NavigationGrid) {}

  update(workers: readonly UnitEntity[], delta: number): void {
    for (const worker of workers) {
      const automation = worker.automation;
      if (!worker.alive || !automation || worker.gatherOrder || worker.buildOrder) continue;
      automation.searchCooldown -= delta;
      if (automation.searchCooldown > 0) continue;
      automation.searchCooldown = AUTOMATION_SEARCH_INTERVAL;
      const target = this.resources.alive()
        .filter((node) => node.resourceType === automation.resourceType)
        .map((node) => ({ node, pathLength: findPath(this.grid, worker.position, node.position).length }))
        .filter(({ pathLength }) => pathLength > 0)
        .sort((a, b) => a.pathLength - b.pathLength || a.node.id.localeCompare(b.node.id))[0]?.node;
      if (target) issueGatherCommand([worker], target, this.grid);
      else worker.activity = automation.resourceType === 'matter' ? 'Automating Matter' : automation.resourceType === 'energy' ? 'Automating Energy' : 'Automating Data';
    }
  }
}
