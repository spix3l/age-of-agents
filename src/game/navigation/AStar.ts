import { NavigationGrid, type GridCell } from './NavigationGrid';
import type { Vec2 } from '../types/simulation';

const DIRECTIONS = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
] as const;

function heuristic(a: GridCell, b: GridCell): number {
  const dx = Math.abs(a.col - b.col);
  const dy = Math.abs(a.row - b.row);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

export function findPath(grid: NavigationGrid, from: Vec2, to: Vec2): Vec2[] {
  const start = grid.findNearestWalkable(from);
  const goal = grid.findNearestWalkable(to);
  if (!start || !goal) return [];
  const startIndex = grid.index(start);
  const goalIndex = grid.index(goal);
  if (startIndex === goalIndex) return [grid.cellToWorld(goal)];

  const total = grid.columns * grid.rows;
  const cameFrom = new Int32Array(total).fill(-1);
  const gScore = new Float64Array(total).fill(Number.POSITIVE_INFINITY);
  const open = new Set<number>([startIndex]);
  gScore[startIndex] = 0;

  while (open.size > 0) {
    let current = -1;
    let best = Number.POSITIVE_INFINITY;
    for (const index of open) {
      const score = (gScore[index] ?? Number.POSITIVE_INFINITY) + heuristic(grid.cellFromIndex(index), goal);
      if (score < best) { best = score; current = index; }
    }
    if (current === goalIndex) return reconstruct(grid, cameFrom, current);
    open.delete(current);
    const cell = grid.cellFromIndex(current);

    for (const [dc, dr] of DIRECTIONS) {
      const next = { col: cell.col + dc, row: cell.row + dr };
      if (!grid.isWalkable(next)) continue;
      if (dc !== 0 && dr !== 0) {
        if (!grid.isWalkable({ col: cell.col + dc, row: cell.row }) ||
            !grid.isWalkable({ col: cell.col, row: cell.row + dr })) continue;
      }
      const nextIndex = grid.index(next);
      const tentative = (gScore[current] ?? Number.POSITIVE_INFINITY) + (dc !== 0 && dr !== 0 ? Math.SQRT2 : 1);
      if (tentative >= (gScore[nextIndex] ?? Number.POSITIVE_INFINITY)) continue;
      cameFrom[nextIndex] = current;
      gScore[nextIndex] = tentative;
      open.add(nextIndex);
    }
  }
  return [];
}

function reconstruct(grid: NavigationGrid, cameFrom: Int32Array, current: number): Vec2[] {
  const path: Vec2[] = [];
  while (current >= 0) {
    path.push(grid.cellToWorld(grid.cellFromIndex(current)));
    current = cameFrom[current] ?? -1;
  }
  path.reverse();
  return simplify(path);
}

function simplify(path: Vec2[]): Vec2[] {
  if (path.length < 3) return path;
  const result: Vec2[] = [path[0]!];
  let lastDx = Math.sign(path[1]!.x - path[0]!.x);
  let lastDz = Math.sign(path[1]!.z - path[0]!.z);
  for (let index = 2; index < path.length; index += 1) {
    const dx = Math.sign(path[index]!.x - path[index - 1]!.x);
    const dz = Math.sign(path[index]!.z - path[index - 1]!.z);
    if (dx !== lastDx || dz !== lastDz) result.push(path[index - 1]!);
    lastDx = dx; lastDz = dz;
  }
  result.push(path[path.length - 1]!);
  return result;
}
