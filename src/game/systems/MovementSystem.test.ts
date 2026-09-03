import { describe, expect, it } from 'vitest';
import type { UnitEntity } from '../types/simulation';
import { createWorkerEntity } from '../scenarios/economy';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { issueMoveCommand } from '../commands/MoveCommand';
import { MovementSystem } from './MovementSystem';

function unit(index: number): UnitEntity {
  return createWorkerEntity(`worker-${index}`, 'player', { x: 1.5 + index % 5, z: 1.5 + Math.floor(index / 5) });
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

  it('keeps previousPosition synced after a path runs out so idle units do not look walking', () => {
    // The renderer derives the walk cycle from position - previousPosition; a stale frozen
    // delta used to keep finished walkers playing their moving animation forever.
    const grid = new NavigationGrid(0, 0, 20, 20);
    const worker = unit(0);
    issueMoveCommand([worker], { x: 8.5, z: 1.5 }, grid);
    const movement = new MovementSystem(grid);
    for (let tick = 0; tick < 600; tick += 1) movement.update([worker], 1 / 30);
    expect(worker.pathIndex).toBe(worker.path.length);
    movement.update([worker], 1 / 30);
    expect(worker.previousPosition.x).toBe(worker.position.x);
    expect(worker.previousPosition.z).toBe(worker.position.z);
  });
});
