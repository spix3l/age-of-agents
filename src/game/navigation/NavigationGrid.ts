import type { Vec2 } from '../types/simulation';

export interface GridCell { readonly col: number; readonly row: number }

export class NavigationGrid {
  readonly columns: number;
  readonly rows: number;
  private readonly blocked: Uint16Array;

  constructor(
    readonly minX: number,
    readonly minZ: number,
    readonly maxX: number,
    readonly maxZ: number,
    readonly cellSize = 1,
  ) {
    this.columns = Math.ceil((maxX - minX) / cellSize);
    this.rows = Math.ceil((maxZ - minZ) / cellSize);
    this.blocked = new Uint16Array(this.columns * this.rows);
  }

  worldToCell(position: Vec2): GridCell {
    return {
      col: Math.max(0, Math.min(this.columns - 1, Math.floor((position.x - this.minX) / this.cellSize))),
      row: Math.max(0, Math.min(this.rows - 1, Math.floor((position.z - this.minZ) / this.cellSize))),
    };
  }

  cellToWorld(cell: GridCell): Vec2 {
    return {
      x: this.minX + (cell.col + 0.5) * this.cellSize,
      z: this.minZ + (cell.row + 0.5) * this.cellSize,
    };
  }

  isInside(cell: GridCell): boolean {
    return cell.col >= 0 && cell.row >= 0 && cell.col < this.columns && cell.row < this.rows;
  }

  isWalkable(cell: GridCell): boolean {
    return this.isInside(cell) && this.blocked[this.index(cell)] === 0;
  }

  setBlocked(cell: GridCell, value: boolean): void {
    if (!this.isInside(cell)) return;
    const index = this.index(cell);
    const count = this.blocked[index] ?? 0;
    this.blocked[index] = value ? Math.min(65_535, count + 1) : Math.max(0, count - 1);
  }

  setBlockedRect(center: Vec2, size: Vec2, value: boolean, padding = 0): void {
    const min = this.worldToCell({ x: center.x - size.x / 2 - padding, z: center.z - size.z / 2 - padding });
    const max = this.worldToCell({ x: center.x + size.x / 2 + padding, z: center.z + size.z / 2 + padding });
    for (let row = min.row; row <= max.row; row += 1) {
      for (let col = min.col; col <= max.col; col += 1) this.setBlocked({ col, row }, value);
    }
  }

  findNearestWalkable(position: Vec2, maxRadius = 12): GridCell | null {
    const origin = this.worldToCell(position);
    if (this.isWalkable(origin)) return origin;
    for (let radius = 1; radius <= maxRadius; radius += 1) {
      for (let row = origin.row - radius; row <= origin.row + radius; row += 1) {
        for (let col = origin.col - radius; col <= origin.col + radius; col += 1) {
          if (Math.max(Math.abs(col - origin.col), Math.abs(row - origin.row)) !== radius) continue;
          const cell = { col, row };
          if (this.isWalkable(cell)) return cell;
        }
      }
    }
    return null;
  }

  index(cell: GridCell): number { return cell.row * this.columns + cell.col; }
  cellFromIndex(index: number): GridCell { return { col: index % this.columns, row: Math.floor(index / this.columns) }; }
}
