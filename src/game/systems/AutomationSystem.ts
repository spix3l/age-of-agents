import { issueGatherCommand } from '../commands/GatherCommand';
import type { EntityRegistry } from '../entities/core/EntityRegistry';
import type { ResourceNodeEntity } from '../entities/resources/ResourceNode';
import { findPath } from '../navigation/AStar';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import { gatherApproachCell } from './GatheringSystem';
import type { UnitEntity } from '../types/simulation';

export const AUTOMATION_SEARCH_INTERVAL = 0.5;

/** How many of the nearest harvestable nodes get a real path search when automation retargets. */
export const AUTOMATION_PATH_CANDIDATES = 3;

export class AutomationSystem {
  constructor(private readonly resources: EntityRegistry<ResourceNodeEntity>, private readonly grid: NavigationGrid) {}

  update(workers: readonly UnitEntity[], delta: number): void {
    for (const worker of workers) {
      const automation = worker.automation;
      if (!worker.alive || !automation || worker.gatherOrder || worker.buildOrder) continue;
      automation.searchCooldown -= delta;
      if (automation.searchCooldown > 0) continue;
      automation.searchCooldown = AUTOMATION_SEARCH_INTERVAL;
      const candidates = this.resources.alive()
        .filter((node) => node.resourceType === automation.resourceType)
        // Straight-line distance first. Pathing to every node of a type, for every automated
        // Worker, twice a second, was the single most expensive thing the simulation did: the
        // full-map A* it needs is thousands of times dearer than the hypot that orders the list.
        .map((node) => ({
          node,
          spread: (node.position.x - worker.position.x) ** 2 + (node.position.z - worker.position.z) ** 2,
        }))
        .sort((a, b) => a.spread - b.spread || a.node.id.localeCompare(b.node.id));

      // Only the nearest few are path-verified. Straight-line order and path order disagree when
      // a ridge sits between the Worker and a node, so the shortest real route among the close
      // candidates is still chosen -- just not by pathing to the whole map.
      const ranked: { node: ResourceNodeEntity; pathLength: number }[] = [];
      for (const { node } of candidates) {
        // Unharvestable nodes (no walkable cell within extraction range) must never win: their
        // degenerate path reads as "closest" and locks every worker onto them.
        if (gatherApproachCell(this.grid, node) === null) continue;
        const pathLength = findPath(this.grid, worker.position, node.position).length;
        if (pathLength > 0) ranked.push({ node, pathLength });
        if (ranked.length >= AUTOMATION_PATH_CANDIDATES) break;
      }
      ranked.sort((a, b) => a.pathLength - b.pathLength || a.node.id.localeCompare(b.node.id));
      const chosen = ranked[0];
      if (chosen) issueGatherCommand([worker], chosen.node, this.grid);
      if (ranked.length === 0) worker.activity = automation.resourceType === 'matter' ? 'Automating Matter' : automation.resourceType === 'energy' ? 'Automating Energy' : 'Automating Data';
    }
  }
}
