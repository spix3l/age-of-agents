import type { ResourceNodeEntity } from '../entities/resources/ResourceNode';
import { findPath } from '../navigation/AStar';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import type { HarvestableResourceType, Vec2 } from '../types/simulation';
import { gatherApproachCell } from './GatheringSystem';

/** How many of the nearest harvestable nodes get a real path search before one is chosen. */
export const NODE_PATH_CANDIDATES = 3;

/**
 * The nearest node of a type a Worker can actually reach and harvest, or null when there is none.
 *
 * Straight-line distance ranks the field first. Pathing to every node of a type, for every Worker
 * that needs one, is thousands of times dearer than the hypot that orders the list, so only the
 * closest few are searched for real -- enough to beat the common case where a ridge sits between
 * the Worker and the node that merely looks closest. Nodes with no walkable cell inside extraction
 * range are dropped outright: they are harvestable by nobody and starve whoever ranks them first.
 */
export function nearestHarvestableNode(
  nodes: readonly ResourceNodeEntity[],
  grid: NavigationGrid,
  from: Vec2,
  type: HarvestableResourceType,
  candidates = NODE_PATH_CANDIDATES,
  /** Straight-line cap on how far to look. Infinite for a standing automation policy. */
  maxRange = Infinity,
): ResourceNodeEntity | null {
  const limit = maxRange * maxRange;
  const ranked = nodes
    .filter((node) => node.alive && node.resourceType === type)
    .map((node) => ({ node, spread: (node.position.x - from.x) ** 2 + (node.position.z - from.z) ** 2 }))
    .filter(({ spread }) => spread <= limit)
    .sort((a, b) => a.spread - b.spread || a.node.id.localeCompare(b.node.id));

  const reachable: { node: ResourceNodeEntity; pathLength: number }[] = [];
  for (const { node } of ranked) {
    if (gatherApproachCell(grid, node) === null) continue;
    const pathLength = findPath(grid, from, node.position).length;
    if (pathLength > 0) reachable.push({ node, pathLength });
    if (reachable.length >= candidates) break;
  }
  reachable.sort((a, b) => a.pathLength - b.pathLength || a.node.id.localeCompare(b.node.id));
  return reachable[0]?.node ?? null;
}
