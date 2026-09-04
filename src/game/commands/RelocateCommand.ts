import { footprintFor } from '../../data/buildings';
import { snappedPlacement, validatePlacement, type PlaceableBuildingType, type PlacementResult } from '../building/PlacementController';
import type { GameState } from '../GameState';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import { setBuildingOccupancy } from '../navigation/occupancy';
import type { BuildingEntity, Vec2 } from '../types/simulation';

export type RelocateRejection = 'NOT_RELOCATABLE' | 'UNDER_CONSTRUCTION' | 'INVALID_PLACEMENT';
export type RelocateResult =
  | { readonly ok: true; readonly position: Vec2; readonly rotated: boolean }
  | { readonly ok: false; readonly reason: RelocateRejection; readonly placement?: PlacementResult };

export interface RelocateContext {
  readonly state: GameState;
  readonly navigation: NavigationGrid;
}

/** The Core anchors the match's loss condition and its start position; it never moves. */
export function canRelocate(building: BuildingEntity): boolean {
  return building.alive && building.kind !== 'core' && building.operational;
}

/**
 * Checks a relocation target. The structure is lifted off the navigation grid for the duration
 * of the check and put straight back, so it never blocks its own destination and the grid's
 * reference counts stay balanced whatever the answer is.
 */
export function validateRelocation(
  building: BuildingEntity,
  rawPosition: Vec2,
  context: RelocateContext,
  rotated = building.rotated,
): PlacementResult {
  const position = snappedPlacement(rawPosition, footprintFor(building.kind, rotated));
  // A structure that died mid-relocation no longer owns any cells: lifting it off the grid here
  // would decrement occupancy its rubble already released.
  if (!context.state.buildings.has(building.id) || !building.alive) {
    return { valid: false, position, rotated, failure: 'BUILDING_OVERLAP' };
  }
  setBuildingOccupancy(context.navigation, building, false);
  try {
    return validatePlacement(
      building.kind as PlaceableBuildingType,
      rawPosition,
      context.navigation,
      context.state.buildings.alive(),
      context.state.resources.alive(),
      rotated,
      building.id,
    );
  } finally {
    setBuildingOccupancy(context.navigation, building, true);
  }
}

/**
 * Picks a completed structure up and sets it down elsewhere, keeping its identity: same id, HP,
 * production queue, capacity contribution, and combat state. Only the footprint it occupies
 * changes, so releasing the old cells and claiming the new ones is the whole transaction.
 */
export function issueRelocateCommand(
  building: BuildingEntity,
  position: Vec2,
  context: RelocateContext,
  rotated = building.rotated,
): RelocateResult {
  if (!context.state.buildings.has(building.id) || !building.alive || building.kind === 'core') {
    return { ok: false, reason: 'NOT_RELOCATABLE' };
  }
  if (!building.operational) return { ok: false, reason: 'UNDER_CONSTRUCTION' };

  const placement = validateRelocation(building, position, context, rotated);
  if (!placement.valid) return { ok: false, reason: 'INVALID_PLACEMENT', placement };

  setBuildingOccupancy(context.navigation, building, false);
  building.position = { x: placement.position.x, z: placement.position.z };
  building.previousPosition = { x: placement.position.x, z: placement.position.z };
  building.rotated = placement.rotated;
  building.footprint = footprintFor(building.kind, placement.rotated);
  setBuildingOccupancy(context.navigation, building, true);
  return { ok: true, position: building.position, rotated: building.rotated };
}
