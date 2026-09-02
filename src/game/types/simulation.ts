import type { EntityId, UnitTypeId } from './ids';

export type Team = 'player' | 'enemy' | 'neutral';
export type ResourceType = 'matter' | 'energy' | 'data';
export type ResourceCost = Readonly<Partial<Record<ResourceType, number>>>;
export type Vec2 = Readonly<{ x: number; z: number }>;

export interface SimEntity {
  readonly id: EntityId;
  readonly kind: UnitTypeId;
  readonly team: Team;
  alive: boolean;
  position: { x: number; z: number };
  previousPosition: { x: number; z: number };
}

export interface UnitEntity extends SimEntity {
  readonly radius: number;
  readonly movementSpeed: number;
  path: Vec2[];
  pathIndex: number;
  destination: Vec2 | null;
  stuckSeconds: number;
  repathCount: number;
  selected: boolean;
}
