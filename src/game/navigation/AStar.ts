import { NavigationGrid, type GridCell } from './NavigationGrid';
import type { Vec2 } from '../types/simulation';

const DIRECTIONS = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
] as const;

/**
 * Hard ceiling on cells expanded by one search. A 240 x 176 map is 42,240 cells, and an
 * unreachable goal — a Worker walled into its own colony, an order clicked onto an island —
 * otherwise exhausts the entire reachable region before it can answer "no". The budget is far
 * above what any real cross-map route needs (a corner-to-corner path expands a few thousand
 * cells), so it only ever truncates a search that was going to fail anyway.
 */
const MAX_EXPANSIONS = 12_000;

/**
 * Search counters for the profiling harness. Two integer increments per search and one per cell
 * expansion: cheap enough to leave in the shipped path, and the only way `profileMatch` can tell
 * "pathfinding is slow" from "pathfinding is called too often".
 */
export const pathMetrics = { searches: 0, expansions: 0 };

export function resetPathMetrics(): void {
  pathMetrics.searches = 0;
  pathMetrics.expansions = 0;
}

function heuristic(a: GridCell, b: GridCell): number {
  const dx = Math.abs(a.col - b.col);
  const dy = Math.abs(a.row - b.row);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

/**
 * Per-grid-size scratch buffers.
 *
 * A search used to allocate a fresh `Int32Array` + `Float64Array` over the whole grid — half a
 * megabyte per call, thousands of calls a minute, all of it garbage. The buffers are reused
 * instead, and `stamp` records which search last wrote a cell so nothing has to be cleared
 * between runs.
 */
interface Scratch {
  readonly cameFrom: Int32Array;
  readonly gScore: Float64Array;
  readonly stamp: Int32Array;
  readonly heapIndex: Int32Array;
  readonly heapScore: Float64Array;
  generation: number;
}

const scratchByCells = new Map<number, Scratch>();

function scratchFor(total: number): Scratch {
  let scratch = scratchByCells.get(total);
  if (!scratch) {
    scratch = {
      cameFrom: new Int32Array(total),
      gScore: new Float64Array(total),
      stamp: new Int32Array(total),
      // Lazy-deletion heap: a cell can be pushed once per improvement, so the heap is sized
      // generously rather than by cell count.
      heapIndex: new Int32Array(total * 4),
      heapScore: new Float64Array(total * 4),
      generation: 0,
    };
    scratchByCells.set(total, scratch);
  }
  return scratch;
}

export function findPath(grid: NavigationGrid, from: Vec2, to: Vec2): Vec2[] {
  pathMetrics.searches += 1;
  const start = grid.findNearestWalkable(from);
  const goal = grid.findNearestWalkable(to);
  if (!start || !goal) return [];
  const startIndex = grid.index(start);
  const goalIndex = grid.index(goal);
  if (startIndex === goalIndex) return [grid.cellToWorld(goal)];

  const total = grid.columns * grid.rows;
  const scratch = scratchFor(total);
  const { cameFrom, gScore, stamp, heapIndex, heapScore } = scratch;
  const generation = (scratch.generation += 1);
  const heapCapacity = heapIndex.length;

  let heapSize = 0;
  const push = (index: number, score: number): void => {
    // A full heap means the search is already far past any legitimate route; let it drain and
    // fail rather than growing without bound.
    if (heapSize >= heapCapacity) return;
    let child = heapSize++;
    heapIndex[child] = index;
    heapScore[child] = score;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if ((heapScore[parent] as number) <= (heapScore[child] as number)) break;
      const tmpIndex = heapIndex[parent] as number;
      const tmpScore = heapScore[parent] as number;
      heapIndex[parent] = heapIndex[child] as number;
      heapScore[parent] = heapScore[child] as number;
      heapIndex[child] = tmpIndex;
      heapScore[child] = tmpScore;
      child = parent;
    }
  };

  const pop = (): number => {
    const top = heapIndex[0] as number;
    heapSize -= 1;
    if (heapSize > 0) {
      heapIndex[0] = heapIndex[heapSize] as number;
      heapScore[0] = heapScore[heapSize] as number;
      let parent = 0;
      for (;;) {
        const left = parent * 2 + 1;
        if (left >= heapSize) break;
        const right = left + 1;
        const smaller = right < heapSize && (heapScore[right] as number) < (heapScore[left] as number) ? right : left;
        if ((heapScore[parent] as number) <= (heapScore[smaller] as number)) break;
        const tmpIndex = heapIndex[parent] as number;
        const tmpScore = heapScore[parent] as number;
        heapIndex[parent] = heapIndex[smaller] as number;
        heapScore[parent] = heapScore[smaller] as number;
        heapIndex[smaller] = tmpIndex;
        heapScore[smaller] = tmpScore;
        parent = smaller;
      }
    }
    return top;
  };

  stamp[startIndex] = generation;
  gScore[startIndex] = 0;
  cameFrom[startIndex] = -1;
  push(startIndex, heuristic(start, goal));

  const closed = new Set<number>();
  let expansions = 0;

  while (heapSize > 0) {
    const current = pop();
    if (closed.has(current)) continue;
    if (current === goalIndex) return reconstruct(grid, cameFrom, current);
    closed.add(current);
    expansions += 1;
    pathMetrics.expansions += 1;
    if (expansions >= MAX_EXPANSIONS) return [];

    const col = current % grid.columns;
    const row = (current - col) / grid.columns;

    for (const [dc, dr] of DIRECTIONS) {
      const next = { col: col + dc, row: row + dr };
      if (!grid.isWalkable(next)) continue;
      if (dc !== 0 && dr !== 0) {
        if (!grid.isWalkable({ col: col + dc, row }) || !grid.isWalkable({ col, row: row + dr })) continue;
      }
      const nextIndex = grid.index(next);
      if (closed.has(nextIndex)) continue;
      const tentative = (gScore[current] as number) + (dc !== 0 && dr !== 0 ? Math.SQRT2 : 1);
      const known = stamp[nextIndex] === generation ? (gScore[nextIndex] as number) : Number.POSITIVE_INFINITY;
      if (tentative >= known) continue;
      stamp[nextIndex] = generation;
      cameFrom[nextIndex] = current;
      gScore[nextIndex] = tentative;
      push(nextIndex, tentative + heuristic(next, goal));
    }
  }
  return [];
}

function reconstruct(grid: NavigationGrid, cameFrom: Int32Array, current: number): Vec2[] {
  const path: Vec2[] = [];
  while (current >= 0) {
    path.push(grid.cellToWorld(grid.cellFromIndex(current)));
    current = cameFrom[current] as number;
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
