import { issueGatherCommand } from '../commands/GatherCommand';
import type { EntityRegistry } from '../entities/core/EntityRegistry';
import type { ResourceNodeEntity } from '../entities/resources/ResourceNode';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import { nearestHarvestableNode, NODE_PATH_CANDIDATES } from './nodeSearch';
import type { UnitEntity } from '../types/simulation';

export const AUTOMATION_SEARCH_INTERVAL = 0.5;

/** How many of the nearest harvestable nodes get a real path search when automation retargets. */
export const AUTOMATION_PATH_CANDIDATES = NODE_PATH_CANDIDATES;

export class AutomationSystem {
  constructor(private readonly resources: EntityRegistry<ResourceNodeEntity>, private readonly grid: NavigationGrid) {}

  update(workers: readonly UnitEntity[], delta: number): void {
    for (const worker of workers) {
      const automation = worker.automation;
      if (!worker.alive || !automation || worker.gatherOrder || worker.buildOrder) continue;
      automation.searchCooldown -= delta;
      if (automation.searchCooldown > 0) continue;
      automation.searchCooldown = AUTOMATION_SEARCH_INTERVAL;
      const chosen = nearestHarvestableNode(this.resources.alive(), this.grid, worker.position, automation.resourceType);
      if (chosen) issueGatherCommand([worker], chosen, this.grid);
      else worker.activity = automation.resourceType === 'matter' ? 'Automating Matter' : automation.resourceType === 'energy' ? 'Automating Energy' : 'Automating Data';
    }
  }
}
