import { BUILDINGS, footprintPadding } from '../../data/buildings';
import type { BuildingTypeId } from '../types/ids';
import type { Vec2 } from '../types/simulation';
import type { NavigationGrid } from './NavigationGrid';

export interface OccupyingBuilding {
  readonly kind: BuildingTypeId;
  readonly position: Vec2;
  readonly footprint: Vec2;
}

/**
 * The only way a building may claim or release navigation cells. Routing every caller through
 * one function is what keeps the grid's reference counts balanced, and it is where a Gate's
 * walk-through exemption and a village piece's zero clearance are decided.
 */
export function setBuildingOccupancy(grid: NavigationGrid, building: OccupyingBuilding, blocked: boolean): void {
  if (!BUILDINGS[building.kind].blocksNavigation) return;
  grid.setBlockedRect(building.position, building.footprint, blocked, footprintPadding(building.kind));
}
