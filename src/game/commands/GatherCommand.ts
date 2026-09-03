import { findPath } from '../navigation/AStar';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import type { ResourceNodeEntity } from '../entities/resources/ResourceNode';
import type { UnitEntity } from '../types/simulation';
import { gatherApproachCell } from '../systems/GatheringSystem';

export interface GatherCommandResult { readonly issued: number; readonly rejected: number }

export function issueGatherCommand(workers: readonly UnitEntity[], node: ResourceNodeEntity, grid: NavigationGrid): GatherCommandResult {
  if (!node.alive || node.remaining <= 0) return { issued: 0, rejected: workers.length };
  // Reject nodes no walkable cell can harvest (spawned against terrain+padding): otherwise the
  // worker walks to the nearest free cell, never enters extraction range, and freezes there.
  const approach = gatherApproachCell(grid, node);
  if (!approach) return { issued: 0, rejected: workers.length };
  let issued = 0;
  for (const worker of workers) {
    if (!worker.alive || worker.kind !== 'worker') continue;
    const path = findPath(grid, worker.position, approach);
    if (path.length === 0) continue;
    worker.path = path;
    worker.pathIndex = path.length > 1 ? 1 : 0;
    worker.destination = node.position;
    worker.stuckSeconds = 0;
    worker.repathCount = 0;
    worker.gatherOrder = { resourceId: node.id, resourceType: node.resourceType, state: 'moving-to-node', workSeconds: 0 };
    worker.activity = `Gathering ${node.resourceType === 'matter' ? 'Matter' : 'Energy'}`;
    issued += 1;
  }
  return { issued, rejected: workers.length - issued };
}
