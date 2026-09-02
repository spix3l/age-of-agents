import type { BuildingTypeId, EntityId, EntityKind, UnitTypeId } from './ids';

export type Team = 'player' | 'enemy' | 'neutral';
export type ResourceType = 'matter' | 'energy' | 'data';
export type ResourceCost = Readonly<Partial<Record<ResourceType, number>>>;
export type Vec2 = Readonly<{ x: number; z: number }>;

export interface SimEntity {
  readonly id: EntityId;
  readonly kind: EntityKind;
  readonly team: Team;
  alive: boolean;
  position: { x: number; z: number };
  previousPosition: { x: number; z: number };
}

export interface UnitEntity extends SimEntity {
  readonly kind: UnitTypeId;
  hp: number;
  readonly maxHp: number;
  readonly radius: number;
  readonly movementSpeed: number;
  path: Vec2[];
  pathIndex: number;
  destination: Vec2 | null;
  stuckSeconds: number;
  repathCount: number;
  selected: boolean;
  activity: WorkerActivity;
  cargo: { type: HarvestableResourceType | null; amount: number };
  gatherOrder: { resourceId: EntityId; resourceType: HarvestableResourceType; state: GatherState; workSeconds: number } | null;
}

export type HarvestableResourceType = Exclude<ResourceType, 'data'>;
export type GatherState = 'moving-to-node' | 'extracting' | 'returning' | 'depositing';
export type WorkerActivity = 'Idle' | 'Moving' | 'Gathering Matter' | 'Gathering Energy' | 'Returning cargo';

export interface ProductionOrder {
  readonly id: EntityId;
  readonly unitType: UnitTypeId;
  readonly duration: number;
  elapsed: number;
  readonly capacity: number;
}

export interface BuildingEntity extends SimEntity {
  readonly kind: BuildingTypeId;
  hp: number;
  readonly maxHp: number;
  readonly footprint: Readonly<{ x: number; z: number }>;
  readonly vision: number;
  readonly acceptsDeposits: boolean;
  readonly capacityContribution: number;
  selected: boolean;
  productionQueue: ProductionOrder[];
}
