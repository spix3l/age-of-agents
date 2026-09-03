export type EntityId = string & { readonly __brand: 'EntityId' };
export type UnitTypeId = 'worker' | 'striker' | 'ranger' | 'scout' | 'titan';
export type BuildingTypeId = 'core' | 'relay' | 'fabricator' | 'habitat' | 'depot' | 'wall' | 'gate' | 'outpost' | 'turret' | 'foundry';
export type ResourceNodeTypeId = 'matter-node' | 'energy-node' | 'data-node';
export type EntityKind = UnitTypeId | BuildingTypeId | ResourceNodeTypeId;
export type OrderId = 'move' | 'gather' | 'produce-worker';

export function entityId(value: string): EntityId {
  if (!/^[a-z][a-z0-9-]*$/i.test(value)) {
    throw new Error(`Invalid entity ID: ${value}`);
  }
  return value as EntityId;
}
