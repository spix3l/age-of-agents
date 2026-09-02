import * as THREE from 'three';
import type { ResourceNodeEntity } from '../entities/resources/ResourceNode';
import type { EntityId } from '../types/ids';
import type { BuildingEntity, UnitEntity } from '../types/simulation';

export interface ScreenPoint { readonly x: number; readonly y: number }
export interface ScreenRect { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
export type SelectableEntity = UnitEntity | BuildingEntity | ResourceNodeEntity;

function isUnit(entity: SelectableEntity): entity is UnitEntity { return 'movementSpeed' in entity; }

export function containsScreenPoint(rect: ScreenRect, point: ScreenPoint): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

export class SelectionSystem {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private selectedIds = new Set<EntityId>();

  constructor(
    private readonly allEntities: () => readonly SelectableEntity[],
    private readonly getEntity: (id: EntityId) => SelectableEntity | undefined,
    private readonly camera: THREE.Camera,
    private readonly canvas: HTMLCanvasElement,
    private readonly selectableMeshes: readonly THREE.Object3D[],
    private readonly onChange: (entities: readonly SelectableEntity[]) => void,
  ) {}

  selectPoint(point: ScreenPoint, additive: boolean): void {
    this.setPointer(point);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects([...this.selectableMeshes], false)
      .find((intersection) => typeof intersection.object.userData.entityId === 'string');
    const id = hit?.object.userData.entityId as EntityId | undefined;
    const entity = id ? this.getEntity(id) : undefined;
    if (!additive) this.selectedIds.clear();
    if (entity?.alive && (entity.team === 'player' || entity.team === 'neutral')) {
      if (additive && this.selectedIds.has(entity.id)) this.selectedIds.delete(entity.id);
      else this.selectedIds.add(entity.id);
    }
    this.commit();
  }

  selectBox(rect: ScreenRect, additive: boolean): void {
    if (!additive) this.selectedIds.clear();
    const bounds = this.canvas.getBoundingClientRect();
    const projected = new THREE.Vector3();
    for (const unit of this.allEntities()) {
      if (!isUnit(unit) || !unit.alive || unit.team !== 'player') continue;
      projected.set(unit.position.x, 0.7, unit.position.z).project(this.camera);
      const point = { x: bounds.left + ((projected.x + 1) / 2) * bounds.width, y: bounds.top + ((1 - projected.y) / 2) * bounds.height };
      if (projected.z >= -1 && projected.z <= 1 && containsScreenPoint(rect, point)) this.selectedIds.add(unit.id);
    }
    this.commit();
  }

  selected(): readonly SelectableEntity[] {
    return [...this.selectedIds].map((id) => this.getEntity(id)).filter((entity): entity is SelectableEntity => Boolean(entity?.alive));
  }

  clear(): void { this.selectedIds.clear(); this.commit(); }

  /** Drops a destroyed entity so its ID can never be re-resolved by a later registry reuse. */
  forget(id: EntityId): void { this.selectedIds.delete(id); }

  private setPointer(point: ScreenPoint): void {
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set(((point.x - bounds.left) / bounds.width) * 2 - 1, -((point.y - bounds.top) / bounds.height) * 2 + 1);
  }

  private commit(): void {
    const selected = this.selected();
    const ids = new Set(selected.map((unit) => unit.id));
    for (const entity of this.allEntities()) entity.selected = ids.has(entity.id);
    this.onChange(selected);
  }
}
