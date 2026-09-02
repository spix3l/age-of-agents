export type EntityId = string & { readonly __brand: 'EntityId' };
export type UnitTypeId = 'worker' | 'striker';
export type BuildingTypeId = 'core' | 'relay' | 'fabricator';
export type OrderId = 'move';

export function entityId(value: string): EntityId {
  if (!/^[a-z][a-z0-9-]*$/i.test(value)) {
    throw new Error(`Invalid entity ID: ${value}`);
  }
  return value as EntityId;
}
