import { BUILDINGS } from '../../data/buildings';
import type { ResourceNodeEntity } from '../entities/resources/ResourceNode';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import type { BuildingTypeId } from '../types/ids';
import type { BuildingEntity, Vec2 } from '../types/simulation';

export type PlaceableBuildingType = Exclude<BuildingTypeId, 'core'>;
export type PlacementFailure = 'OUT_OF_BOUNDS' | 'BLOCKED' | 'RESOURCE_OVERLAP' | 'BUILDING_OVERLAP';
export interface PlacementResult { readonly valid: boolean; readonly position: Vec2; readonly failure?: PlacementFailure }

export function snappedPlacement(position: Vec2): Vec2 {
  return { x: Math.floor(position.x) + 0.5, z: Math.floor(position.z) + 0.5 };
}

export function validatePlacement(
  type: PlaceableBuildingType,
  rawPosition: Vec2,
  grid: NavigationGrid,
  buildings: readonly BuildingEntity[],
  resources: readonly ResourceNodeEntity[],
): PlacementResult {
  const position = snappedPlacement(rawPosition);
  const config = BUILDINGS[type];
  const halfX = config.footprint[0] / 2;
  const halfZ = config.footprint[1] / 2;
  if (position.x - halfX < grid.minX || position.x + halfX > grid.maxX || position.z - halfZ < grid.minZ || position.z + halfZ > grid.maxZ) {
    return { valid: false, position, failure: 'OUT_OF_BOUNDS' };
  }

  const minCell = grid.worldToCell({ x: position.x - halfX + 0.01, z: position.z - halfZ + 0.01 });
  const maxCell = grid.worldToCell({ x: position.x + halfX - 0.01, z: position.z + halfZ - 0.01 });
  for (let row = minCell.row; row <= maxCell.row; row += 1) {
    for (let col = minCell.col; col <= maxCell.col; col += 1) {
      if (!grid.isWalkable({ col, row })) return { valid: false, position, failure: 'BLOCKED' };
    }
  }

  for (const building of buildings) {
    if (!building.alive) continue;
    if (overlaps(position, { x: config.footprint[0], z: config.footprint[1] }, building.position, building.footprint, 0.35)) {
      return { valid: false, position, failure: 'BUILDING_OVERLAP' };
    }
  }
  for (const resource of resources) {
    if (!resource.alive) continue;
    if (overlaps(position, { x: config.footprint[0], z: config.footprint[1] }, resource.position, { x: 3, z: 3 }, 0.5)) {
      return { valid: false, position, failure: 'RESOURCE_OVERLAP' };
    }
  }
  return { valid: true, position };
}

function overlaps(a: Vec2, aSize: Vec2, b: Vec2, bSize: Vec2, padding: number): boolean {
  return Math.abs(a.x - b.x) < (aSize.x + bSize.x) / 2 + padding && Math.abs(a.z - b.z) < (aSize.z + bSize.z) / 2 + padding;
}

interface PlacementControllerCallbacks {
  readonly validate: (type: PlaceableBuildingType, position: Vec2) => PlacementResult;
  readonly preview: (type: PlaceableBuildingType, result: PlacementResult) => void;
  readonly hide: () => void;
  readonly confirmed: (type: PlaceableBuildingType, result: PlacementResult) => void;
  readonly rejected: (failure: PlacementFailure) => void;
}

export class PlacementController {
  private typeValue: PlaceableBuildingType | null = null;
  private candidate: PlacementResult | null = null;

  constructor(private readonly callbacks: PlacementControllerCallbacks) {}

  get active(): boolean { return this.typeValue !== null; }
  get type(): PlaceableBuildingType | null { return this.typeValue; }

  begin(type: PlaceableBuildingType): void {
    this.typeValue = type;
    this.candidate = null;
  }

  update(position: Vec2): boolean {
    if (!this.typeValue) return false;
    this.candidate = this.callbacks.validate(this.typeValue, position);
    this.callbacks.preview(this.typeValue, this.candidate);
    return true;
  }

  confirm(position: Vec2): boolean {
    if (!this.typeValue) return false;
    const result = this.callbacks.validate(this.typeValue, position);
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
    this.callbacks.hide();
    return true;
  }
}
