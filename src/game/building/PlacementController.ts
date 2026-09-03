import { footprintFor, placementClearance, resourceClearance } from '../../data/buildings';
import type { ResourceNodeEntity } from '../entities/resources/ResourceNode';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import type { BuildingTypeId } from '../types/ids';
import type { BuildingEntity, Vec2 } from '../types/simulation';

export type PlaceableBuildingType = Exclude<BuildingTypeId, 'core'>;
export type PlacementFailure = 'OUT_OF_BOUNDS' | 'BLOCKED' | 'RESOURCE_OVERLAP' | 'BUILDING_OVERLAP';
export interface PlacementResult { readonly valid: boolean; readonly position: Vec2; readonly rotated: boolean; readonly failure?: PlacementFailure }

/**
 * Snaps a raw world position onto the building's footprint alignment: even-sized axes center
 * on cell boundaries (an integer), odd-sized axes on cell centers (half-integer). A 2x1 wall
 * therefore covers exactly two whole cells, which is what lets the next wall sit flush against
 * it; the old cell-center-only snap made even footprints straddle three half-covered cells and
 * the boundary cells' blockage rejected every neighbour.
 */
export function snappedPlacement(position: Vec2, footprint?: { readonly x: number; readonly z: number }): Vec2 {
  if (!footprint) return { x: Math.floor(position.x) + 0.5, z: Math.floor(position.z) + 0.5 };
  const snapAxis = (value: number, size: number): number =>
    size % 2 === 0 ? Math.round(value) : Math.floor(value) + 0.5;
  return { x: snapAxis(position.x, footprint.x), z: snapAxis(position.z, footprint.z) };
}

export function validatePlacement(
  type: PlaceableBuildingType,
  rawPosition: Vec2,
  grid: NavigationGrid,
  buildings: readonly BuildingEntity[],
  resources: readonly ResourceNodeEntity[],
  rotated = false,
): PlacementResult {
  const footprint = footprintFor(type, rotated);
  const position = snappedPlacement(rawPosition, footprint);
  const halfX = footprint.x / 2;
  const halfZ = footprint.z / 2;
  if (position.x - halfX < grid.minX || position.x + halfX > grid.maxX || position.z - halfZ < grid.minZ || position.z + halfZ > grid.maxZ) {
    return { valid: false, position, rotated, failure: 'OUT_OF_BOUNDS' };
  }

  // Same cell-center coverage rule as NavigationGrid.setBlockedRect, so the placement check and
  // the occupancy claim always agree on which cells a building owns.
  const minCell = grid.worldToCell({ x: position.x - halfX, z: position.z - halfZ });
  const maxCell = grid.worldToCell({ x: position.x + halfX, z: position.z + halfZ });
  for (let row = minCell.row; row <= maxCell.row; row += 1) {
    for (let col = minCell.col; col <= maxCell.col; col += 1) {
      const center = grid.cellToWorld({ col, row });
      if (center.x < position.x - halfX || center.x > position.x + halfX) continue;
      if (center.z < position.z - halfZ || center.z > position.z + halfZ) continue;
      if (!grid.isWalkable({ col, row })) return { valid: false, position, rotated, failure: 'BLOCKED' };
    }
  }

  for (const building of buildings) {
    if (!building.alive) continue;
    // Village pieces sit flush: a wall line is only continuous if segments may touch edges.
    const clearance = placementClearance(type, building.kind);
    if (overlaps(position, footprint, building.position, building.footprint, clearance)) {
      return { valid: false, position, rotated, failure: 'BUILDING_OVERLAP' };
    }
  }
  for (const resource of resources) {
    if (!resource.alive) continue;
    // Village pieces may run right up to a deposit; anything else keeps its distance so a node
    // is never walled off from the colony that has to harvest it.
    if (overlaps(position, footprint, resource.position, RESOURCE_BODY, resourceClearance(type))) {
      return { valid: false, position, rotated, failure: 'RESOURCE_OVERLAP' };
    }
  }
  return { valid: true, position, rotated };
}

/** The footprint a resource node occupies for placement purposes. */
const RESOURCE_BODY: Vec2 = { x: 2.4, z: 2.4 };

function overlaps(a: Vec2, aSize: Vec2, b: Vec2, bSize: Vec2, padding: number): boolean {
  return Math.abs(a.x - b.x) < (aSize.x + bSize.x) / 2 + padding && Math.abs(a.z - b.z) < (aSize.z + bSize.z) / 2 + padding;
}

interface PlacementControllerCallbacks {
  readonly validate: (type: PlaceableBuildingType, position: Vec2, rotated: boolean) => PlacementResult;
  readonly preview: (type: PlaceableBuildingType, result: PlacementResult) => void;
  readonly hide: () => void;
  readonly confirmed: (type: PlaceableBuildingType, result: PlacementResult) => void;
  readonly rejected: (failure: PlacementFailure) => void;
}

export class PlacementController {
  private typeValue: PlaceableBuildingType | null = null;
  private candidate: PlacementResult | null = null;
  private lastPosition: Vec2 | null = null;
  /** Survives one placement so a rotated wall keeps its orientation down a whole line. */
  private rotatedValue = false;

  constructor(private readonly callbacks: PlacementControllerCallbacks) {}

  get active(): boolean { return this.typeValue !== null; }
  get type(): PlaceableBuildingType | null { return this.typeValue; }
  get rotated(): boolean { return this.rotatedValue; }

  begin(type: PlaceableBuildingType): void {
    this.typeValue = type;
    this.candidate = null;
  }

  /** Quarter-turns the pending footprint, which is what makes a vertical wall run possible. */
  rotate(): boolean {
    if (!this.typeValue) return false;
    this.rotatedValue = !this.rotatedValue;
    if (this.lastPosition) this.update(this.lastPosition);
    return true;
  }

  update(position: Vec2): boolean {
    if (!this.typeValue) return false;
    this.lastPosition = position;
    this.candidate = this.callbacks.validate(this.typeValue, position, this.rotatedValue);
    this.callbacks.preview(this.typeValue, this.candidate);
    return true;
  }

  confirm(position: Vec2): boolean {
    if (!this.typeValue) return false;
    const result = this.callbacks.validate(this.typeValue, position, this.rotatedValue);
    this.candidate = result;
    this.callbacks.preview(this.typeValue, result);
    if (!result.valid) {
      this.callbacks.rejected(result.failure!);
      return true;
    }
    const type = this.typeValue;
    this.cancel();
    this.callbacks.confirmed(type, result);
    return true;
  }

  cancel(): boolean {
    if (!this.typeValue) return false;
    this.typeValue = null;
    this.candidate = null;
    this.lastPosition = null;
    this.callbacks.hide();
    return true;
  }
}
