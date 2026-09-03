import { setBuildingOccupancy } from '../navigation/occupancy';
import { UNITS } from '../../data/units';
import { deactivateCapacityProvider } from '../economy/CapacityProviders';
import type { GameState } from '../GameState';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import type { BuildingEntity, CombatTarget, UnitEntity } from '../types/simulation';

export interface DestructionWorld {
  readonly state: GameState;
  readonly navigation: NavigationGrid;
  readonly onUnitRemoved?: (unit: UnitEntity) => void;
  readonly onBuildingRemoved?: (building: BuildingEntity) => void;
}

/**
 * Removes a dead entity and every reference to it: selection, orders, combat targets,
 * Agent Capacity, navigation occupancy, and queued production reservations.
 */
export function destroyEntity(entity: CombatTarget, world: DestructionWorld): boolean {
  return 'footprint' in entity ? destroyBuilding(entity, world) : destroyUnit(entity, world);
}

export function destroyUnit(unit: UnitEntity, world: DestructionWorld): boolean {
  if (!world.state.units.has(unit.id)) return false;
  const economy = unit.team === 'neutral' ? undefined : world.state.economies.get(unit.team);
  economy?.capacity.releaseUsed(UNITS[unit.kind].capacityCost);
  if (unit.buildOrder) {
    const site = world.state.buildings.get(unit.buildOrder.buildingId);
    if (site?.builderId === unit.id) site.builderId = null;
  }
  unit.selected = false;
  unit.gatherOrder = null;
  unit.buildOrder = null;
  unit.automation = null;
  unit.path = [];
  unit.pathIndex = 0;
  unit.destination = null;
  unit.combat.targetId = null;
  unit.combat.ordered = false;
  world.state.units.destroy(unit.id);
  clearReferencesTo(unit.id, world.state);
  world.onUnitRemoved?.(unit);
  return true;
}

export function destroyBuilding(building: BuildingEntity, world: DestructionWorld): boolean {
  if (!world.state.buildings.has(building.id)) return false;
  const economy = building.team === 'neutral' ? undefined : world.state.economies.get(building.team);
  if (economy) {
    deactivateCapacityProvider(building, economy.capacity);
    // Destroyed production is lost, but its capacity reservations must never leak.
    for (const order of building.productionQueue) economy.capacity.cancel(order.capacity);
  }
  building.productionQueue.length = 0;
  building.selected = false;
  building.operational = false;
  building.builderId = null;
  setBuildingOccupancy(world.navigation, building, false);
  world.state.buildings.destroy(building.id);
  clearReferencesTo(building.id, world.state);
  world.onBuildingRemoved?.(building);
  return true;
}

function clearReferencesTo(id: CombatTarget['id'], state: GameState): void {
  for (const unit of state.units.alive()) {
    if (unit.combat.targetId === id) {
      unit.combat.targetId = null;
      unit.combat.ordered = false;
    }
    if (unit.buildOrder?.buildingId === id) {
      unit.buildOrder = null;
      unit.path = [];
      unit.pathIndex = 0;
      unit.destination = null;
      unit.activity = 'Idle';
    }
  }
  // Turrets hold a target too, and a dead ID must never survive to be re-resolved.
  for (const building of state.buildings.alive()) {
    if (building.combat?.targetId === id) building.combat.targetId = null;
  }
}
