import type { ResourceCost } from '../game/types/simulation';
import type { UnitConfig } from './units';
import type { BuildingConfig } from './buildings';
import { SYNTHESIS } from './synthesis';

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
  if (config.capacityUse < 0 || (config.capacityUse > 0 && config.capacityContribution > 0)) {
    throw new Error(`${config.id} cannot both provide and occupy Agent Capacity`);
  }
  // A structure that consumes Agent Capacity but converts nothing is charging the colony for
  // no reason, and a plant that costs nothing to crew is a free resource printer.
  const recipe = SYNTHESIS[config.id];
  if (recipe && config.capacityUse <= 0) throw new Error(`${config.id} synthesizes without occupying capacity`);
  if (!recipe && config.capacityUse > 0) throw new Error(`${config.id} occupies capacity without synthesizing`);
  if (recipe) {
    if (recipe.cycleSeconds <= 0 || recipe.amount <= 0) throw new Error(`${config.id} has an invalid synthesis cycle`);
    validateCost(recipe.input, `${config.id} synthesis`);
    if (Object.keys(recipe.input).length === 0) throw new Error(`${config.id} synthesizes out of nothing`);
    if (recipe.output in recipe.input) throw new Error(`${config.id} synthesizes what it consumes`);
  }
  validateCost(config.cost, config.id);
}
