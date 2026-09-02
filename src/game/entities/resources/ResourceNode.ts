import type { EntityId, ResourceNodeTypeId } from '../../types/ids';
import type { HarvestableResourceType, SimEntity, Team, Vec2 } from '../../types/simulation';

export interface ResourceNodeEntity extends SimEntity {
  readonly kind: ResourceNodeTypeId;
  readonly team: Team;
  readonly resourceType: HarvestableResourceType;
  readonly capacity: number;
  remaining: number;
  selected: boolean;
}

export function createResourceNode(id: EntityId, type: HarvestableResourceType, position: Vec2, capacity: number): ResourceNodeEntity {
  if (!Number.isFinite(capacity) || capacity <= 0) throw new Error('Resource node capacity must be positive');
  return {
    id,
    kind: type === 'matter' ? 'matter-node' : 'energy-node',
    team: 'neutral',
    alive: true,
    position: { ...position },
    previousPosition: { ...position },
    resourceType: type,
    capacity,
    remaining: capacity,
    selected: false,
  };
}

export function extractResource(node: ResourceNodeEntity, requested: number): number {
  if (!node.alive || requested <= 0) return 0;
  const extracted = Math.min(node.remaining, requested);
  node.remaining -= extracted;
  if (node.remaining <= 0) {
    node.remaining = 0;
    node.alive = false;
  }
  return extracted;
}

export function isDepleted(node: ResourceNodeEntity): boolean { return node.remaining <= 0 || !node.alive; }
