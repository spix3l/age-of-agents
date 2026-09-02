import * as THREE from 'three';
import { EntityRegistry } from '../entities/core/EntityRegistry';
import type { EntityId } from '../types/ids';
import type { UnitEntity } from '../types/simulation';

export interface ScreenPoint { readonly x: number; readonly y: number }
export interface ScreenRect { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

export function containsScreenPoint(rect: ScreenRect, point: ScreenPoint): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

export class SelectionSystem {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private selectedIds = new Set<EntityId>();

  constructor(
    private readonly registry: EntityRegistry<UnitEntity>,
    private readonly camera: THREE.Camera,
    private readonly canvas: HTMLCanvasElement,
    private readonly selectableMeshes: readonly THREE.Object3D[],
    private readonly onChange: (units: readonly UnitEntity[]) => void,
  ) {}

  selectPoint(point: ScreenPoint, additive: boolean): void {
    this.setPointer(point);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects([...this.selectableMeshes], false)
      .find((intersection) => typeof intersection.object.userData.entityId === 'string');
    const id = hit?.object.userData.entityId as EntityId | undefined;
    const unit = id ? this.registry.get(id) : undefined;
    if (!additive) this.selectedIds.clear();
    if (unit?.alive && unit.team === 'player') {
      if (additive && this.selectedIds.has(unit.id)) this.selectedIds.delete(unit.id);
      else this.selectedIds.add(unit.id);
    }
    this.commit();
  }

  selectBox(rect: ScreenRect, additive: boolean): void {
    if (!additive) this.selectedIds.clear();
    const bounds = this.canvas.getBoundingClientRect();
    const projected = new THREE.Vector3();
    for (const unit of this.registry.alive()) {
      if (unit.team !== 'player') continue;
      projected.set(unit.position.x, 0.7, unit.position.z).project(this.camera);
      const point = { x: bounds.left + ((projected.x + 1) / 2) * bounds.width, y: bounds.top + ((1 - projected.y) / 2) * bounds.height };
      if (projected.z >= -1 && projected.z <= 1 && containsScreenPoint(rect, point)) this.selectedIds.add(unit.id);
    }
    this.commit();
  }

  selected(): readonly UnitEntity[] {
    return [...this.selectedIds].map((id) => this.registry.get(id)).filter((unit): unit is UnitEntity => Boolean(unit?.alive));
  }

  clear(): void { this.selectedIds.clear(); this.commit(); }

  private setPointer(point: ScreenPoint): void {
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set(((point.x - bounds.left) / bounds.width) * 2 - 1, -((point.y - bounds.top) / bounds.height) * 2 + 1);
  }

  private commit(): void {
    const selected = this.selected();
    const ids = new Set(selected.map((unit) => unit.id));
    for (const unit of this.registry.all()) unit.selected = ids.has(unit.id);
    this.onChange(selected);
  }
}
