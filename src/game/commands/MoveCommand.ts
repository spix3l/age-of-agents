import type { UnitEntity, Vec2 } from '../types/simulation';
import { findPath } from '../navigation/AStar';
import { NavigationGrid } from '../navigation/NavigationGrid';
import type { GridCell } from '../navigation/NavigationGrid';

export interface MoveCommandResult {
  readonly issued: number;
  readonly destinationSlots: readonly Vec2[];
}

export function issueMoveCommand(units: readonly UnitEntity[], target: Vec2, grid: NavigationGrid): MoveCommandResult {
  const liveUnits = units.filter((unit) => unit.alive);
  const spacing = 1.35;
  const slots: Vec2[] = [];
  const reserved = new Set<number>();

  liveUnits.forEach((unit, index) => {
    const ring = Math.ceil((Math.sqrt(index + 1) - 1) / 2);
    const countOnRing = Math.max(1, ring * 8);
    const firstOnRing = ring === 0 ? 0 : (ring * 2 - 1) ** 2;
    const angle = ((index - firstOnRing) / countOnRing) * Math.PI * 2;
    const desired = ring === 0 ? target : {
      x: target.x + Math.cos(angle) * ring * spacing,
      z: target.z + Math.sin(angle) * ring * spacing,
    };
    const cell = findAvailableCell(grid, desired, reserved);
    if (!cell) return;
    reserved.add(grid.index(cell));
    const slot = grid.cellToWorld(cell);
    const path = findPath(grid, unit.position, slot);
    unit.path = path;
    unit.pathIndex = path.length > 1 ? 1 : 0;
    unit.destination = path.length > 0 ? slot : null;
    unit.stuckSeconds = 0;
    unit.repathCount = 0;
    slots.push(slot);
  });

  return { issued: slots.length, destinationSlots: slots };
}

function findAvailableCell(grid: NavigationGrid, desired: Vec2, reserved: ReadonlySet<number>): GridCell | null {
  const origin = grid.worldToCell(desired);
  for (let radius = 0; radius <= 12; radius += 1) {
    for (let row = origin.row - radius; row <= origin.row + radius; row += 1) {
      for (let col = origin.col - radius; col <= origin.col + radius; col += 1) {
        if (radius > 0 && Math.max(Math.abs(col - origin.col), Math.abs(row - origin.row)) !== radius) continue;
        const cell = { col, row };
        if (grid.isWalkable(cell) && !reserved.has(grid.index(cell))) return cell;
      }
    }
  }
  return null;
}
