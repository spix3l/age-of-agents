import { describe, expect, it } from 'vitest';
import { NavigationGrid } from './NavigationGrid';
import { findPath } from './AStar';

describe('NavigationGrid and A*', () => {
  it('round-trips world and cell positions', () => {
    const grid = new NavigationGrid(-5, -5, 5, 5);
    expect(grid.worldToCell(grid.cellToWorld({ col: 3, row: 7 }))).toEqual({ col: 3, row: 7 });
  });

  it('handles same-cell and boundary destinations', () => {
    const grid = new NavigationGrid(0, 0, 5, 5);
    expect(findPath(grid, { x: 0.1, z: 0.1 }, { x: 0.8, z: 0.8 })).toHaveLength(1);
    expect(findPath(grid, { x: -20, z: -20 }, { x: 30, z: 30 }).at(-1)).toEqual({ x: 4.5, z: 4.5 });
  });

  it('routes through a fixed obstacle maze without corner cutting', () => {
    const grid = new NavigationGrid(0, 0, 8, 8);
    for (let row = 0; row < 7; row += 1) if (row !== 5) grid.setBlocked({ col: 3, row }, true);
    grid.setBlocked({ col: 4, row: 4 }, true);
    const path = findPath(grid, { x: 1.5, z: 1.5 }, { x: 6.5, z: 1.5 });
    expect(path.length).toBeGreaterThan(2);
    expect(path.every((point) => grid.isWalkable(grid.worldToCell(point)))).toBe(true);
  });

  it('returns no route for an enclosed target and supports removing occupancy', () => {
    const grid = new NavigationGrid(0, 0, 5, 5);
    for (let row = 0; row < 5; row += 1) grid.setBlocked({ col: 2, row }, true);
    expect(findPath(grid, { x: 0.5, z: 2.5 }, { x: 4.5, z: 2.5 })).toEqual([]);
    grid.setBlocked({ col: 2, row: 2 }, false);
    expect(findPath(grid, { x: 0.5, z: 2.5 }, { x: 4.5, z: 2.5 }).length).toBeGreaterThan(0);
  });
});
