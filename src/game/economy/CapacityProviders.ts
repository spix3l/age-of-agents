import type { BuildingEntity } from '../types/simulation';
import type { Capacity } from './Capacity';

/**
 * Applies a completed structure's standing effect on Agent Capacity.
 *
 * A structure is either a provider (a Relay or Habitat raises the ceiling) or a consumer (a
 * synthesis plant is crewed and occupies slots), never both, so one `capacityApplied` flag
 * covers the pair and a structure's effect is applied and removed exactly once.
 */
export function activateCapacityProvider(building: BuildingEntity, capacity: Capacity): boolean {
  if (!building.alive || !building.operational || building.capacityApplied) return false;
  if (building.capacityContribution > 0) capacity.addProvider(building.capacityContribution);
  else if (building.capacityUse > 0) capacity.occupyUsed(building.capacityUse);
  else return false;
  building.capacityApplied = true;
  return true;
}

export function deactivateCapacityProvider(building: BuildingEntity, capacity: Capacity): boolean {
  if (!building.capacityApplied) return false;
  if (building.capacityContribution > 0) capacity.removeProvider(building.capacityContribution);
  else if (building.capacityUse > 0) capacity.releaseUsed(building.capacityUse);
  else return false;
  building.capacityApplied = false;
  return true;
}
