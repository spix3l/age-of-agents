import type { ResourceCost } from '../game/types/simulation';
import type { UnitConfig } from './units';
import type { BuildingConfig } from './buildings';

function validateCost(cost: ResourceCost, context: string): void {
  for (const [resource, value] of Object.entries(cost)) {
    if (value === undefined || !Number.isFinite(value) || value < 0) {
      throw new Error(`${context} has invalid ${resource} cost`);
    }
  }
}

export function validateUnitConfig(config: UnitConfig): void {
  if (!config.id || !config.label) throw new Error('Unit IDs and labels are required');
  if (config.maxHp <= 0 || config.movementSpeed <= 0 || config.radius <= 0) {
    throw new Error(`${config.id} must have positive stats`);
  }
  if (config.capacityCost < 0 || config.productionTime < 0) {
    throw new Error(`${config.id} has a negative capacity or production time`);
  }
  if (config.attackDamage < 0 || config.attackRange <= 0 || config.attackCooldown <= 0 || config.vision <= 0) {
    throw new Error(`${config.id} has invalid combat stats`);
  }
  validateCost(config.cost, config.id);
}

export function validateBuildingConfig(config: BuildingConfig): void {
  if (!config.id || !config.label) throw new Error('Building IDs and labels are required');
  if (config.maxHp <= 0 || config.footprint.some((value) => value <= 0)) {
    throw new Error(`${config.id} must have positive stats`);
  }
  validateCost(config.cost, config.id);
}
