import { describe, expect, it } from 'vitest';
import { entityId } from '../types/ids';
import type { UnitEntity } from '../types/simulation';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { issueMoveCommand } from '../commands/MoveCommand';
import { MovementSystem } from './MovementSystem';

function unit(index: number): UnitEntity {
  return { id: entityId(`worker-${index}`), kind: 'worker', team: 'player', alive: true, position: { x: 1.5 + index % 5, z: 1.5 + Math.floor(index / 5) }, previousPosition: { x: 0, z: 0 }, radius: 0.45, movementSpeed: 5, path: [], pathIndex: 0, destination: null, stuckSeconds: 0, repathCount: 0, selected: false };
}

describe('group movement', () => {
  it('gives 30 live units distinct walkable slots and ignores destroyed units', () => {
    const grid = new NavigationGrid(0, 0, 40, 40);
    const units = Array.from({ length: 31 }, (_, index) => unit(index));
    units[30]!.alive = false;
    const result = issueMoveCommand(units, { x: 25, z: 25 }, grid);
    expect(result.issued).toBe(30);
    expect(new Set(result.destinationSlots.map(({ x, z }) => `${x},${z}`)).size).toBe(30);
  });

  it('resolves a blocked destination and reaches tolerance', () => {
    const grid = new NavigationGrid(0, 0, 20, 20);
    grid.setBlockedRect({ x: 10, z: 10 }, { x: 3, z: 3 }, true);
    const worker = unit(0);
    issueMoveCommand([worker], { x: 10, z: 10 }, grid);
    expect(grid.isWalkable(grid.worldToCell(worker.destination!))).toBe(true);
    const movement = new MovementSystem(grid);
    for (let tick = 0; tick < 300; tick += 1) movement.update([worker], 1 / 30);
    expect(worker.destination).toBeNull();
  });
});
