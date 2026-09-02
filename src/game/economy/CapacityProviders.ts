import type { BuildingEntity } from '../types/simulation';
import type { Capacity } from './Capacity';

export function activateCapacityProvider(building: BuildingEntity, capacity: Capacity): boolean {
  if (!building.alive || !building.operational || building.capacityApplied || building.capacityContribution <= 0) return false;
  capacity.addProvider(building.capacityContribution);
  building.capacityApplied = true;
  return true;
}

export function deactivateCapacityProvider(building: BuildingEntity, capacity: Capacity): boolean {
  if (!building.capacityApplied || building.capacityContribution <= 0) return false;
  capacity.removeProvider(building.capacityContribution);
  building.capacityApplied = false;
  return true;
}
