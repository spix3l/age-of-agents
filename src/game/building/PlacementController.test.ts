import { describe, expect, it, vi } from 'vitest';
import { createBuildingSite } from '../entities/buildings/Building';
import { createCore } from '../entities/buildings/Core';
import { createResourceNode } from '../entities/resources/ResourceNode';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { setBuildingOccupancy } from '../navigation/occupancy';
import { entityId } from '../types/ids';
import { PlacementController, validatePlacement } from './PlacementController';

describe('building placement', () => {
  const grid = new NavigationGrid(0, 0, 30, 30);
  const core = createCore(entityId('placement-core'), 'player', { x: 6, z: 6 });
  const resource = createResourceNode(entityId('placement-matter'), 'matter', { x: 20, z: 20 }, 100);

  it('accepts open terrain and rejects boundaries, blockers, resources, and buildings', () => {
    grid.setBlockedRect({ x: 14, z: 14 }, { x: 3, z: 3 }, true);
    // Even footprints snap to cell boundaries: a relay centers on the integer grid.
    expect(validatePlacement('relay', { x: 10, z: 20 }, grid, [core], [resource])).toMatchObject({ valid: true, position: { x: 10, z: 20 } });
    expect(validatePlacement('fabricator', { x: 0, z: 1 }, grid, [core], [resource]).failure).toBe('OUT_OF_BOUNDS');
    expect(validatePlacement('relay', { x: 14, z: 14 }, grid, [core], [resource]).failure).toBe('BLOCKED');
    expect(validatePlacement('relay', { x: 20, z: 20 }, grid, [core], [resource]).failure).toBe('RESOURCE_OVERLAP');
    expect(validatePlacement('relay', { x: 6, z: 6 }, grid, [core], [resource]).failure).toBe('BUILDING_OVERLAP');
  });

  it('revalidates on confirmation and supports cancellation', () => {
    let valid = true;
    const confirmed = vi.fn();
    const rejected = vi.fn();
    const controller = new PlacementController({
      validate: (_type, position, rotated) => ({ valid, position, rotated, failure: valid ? undefined : 'BLOCKED' }),
      preview: vi.fn(), hide: vi.fn(), confirmed, rejected,
    });
    controller.begin('relay');
    controller.update({ x: 10, z: 10 });
    valid = false;
    expect(controller.confirm({ x: 10, z: 10 })).toBe(true);
    expect(rejected).toHaveBeenCalledWith('BLOCKED');
    expect(confirmed).not.toHaveBeenCalled();
    expect(controller.active).toBe(true);
    expect(controller.cancel()).toBe(true);
    expect(controller.active).toBe(false);
  });

  it('quarter-turns the pending footprint so a wall line can run in either direction', () => {
    const grid = new NavigationGrid(-32, -32, 32, 32);
    const first = validatePlacement('wall', { x: 0, z: 0 }, grid, [], []);
    expect(first).toMatchObject({ valid: true, rotated: false });
    expect(validatePlacement('wall', { x: 0, z: 0 }, grid, [], [], true)).toMatchObject({ valid: true, rotated: true });

    const seen: boolean[] = [];
    const controller = new PlacementController({
      validate: (_type, position, rotated) => { seen.push(rotated); return { valid: true, position, rotated }; },
      preview: vi.fn(), hide: vi.fn(), confirmed: vi.fn(), rejected: vi.fn(),
    });
    controller.begin('wall');
    controller.update({ x: 4, z: 4 });
    expect(controller.rotate()).toBe(true);
    expect(controller.rotated).toBe(true);
    // Rotating revalidates the ghost in place rather than waiting for the next pointer move.
    expect(seen).toEqual([false, true]);
  });

  it('lets Barrier Walls sit edge to edge while keeping clearance around a Fabricator', () => {
    const grid = new NavigationGrid(-32, -32, 32, 32);
    const builder = entityId('worker-1');
    // A wall's parity snap puts its 4-long axis on the integer grid: this one spans x[-2,2].
    const wall = createBuildingSite(entityId('wall-1'), 'wall', 'player', { x: 0, z: 0.5 }, builder);
    // The neighbour's footprint starts exactly where the first one ends.
    expect(validatePlacement('wall', { x: 4, z: 0 }, grid, [wall], [])).toMatchObject({ valid: true });
    expect(validatePlacement('wall', { x: 2, z: 0 }, grid, [wall], []).failure).toBe('BUILDING_OVERLAP');

    const fabricator = createBuildingSite(entityId('fab-1'), 'fabricator', 'player', { x: 10.5, z: 10.5 }, builder);
    expect(validatePlacement('relay', { x: 13, z: 10 }, grid, [fabricator], []).failure).toBe('BUILDING_OVERLAP');
  });

  it('lets a wall claim the cell flush next to an existing wall on the navigation grid', () => {
    // Regression: placement allowed flush walls, but the occupancy claim over-blocked the
    // boundary cell, so the neighbour was rejected as BLOCKED in a real match.
    const grid = new NavigationGrid(-32, -32, 32, 32);
    const builder = entityId('worker-1');
    const first = validatePlacement('wall', { x: 0, z: 0 }, grid, [], []);
    expect(first.valid).toBe(true);
    const wall = createBuildingSite(entityId('wall-1'), 'wall', 'player', first.position, builder);
    setBuildingOccupancy(grid, wall, true);

    const neighbour = validatePlacement('wall', { x: 4.2, z: 0.4 }, grid, [wall], []);
    expect(neighbour).toMatchObject({ valid: true, position: { x: 4, z: 0.5 } });

    // Still no placing on top of the claimed cells, and a rotated wall stacks flush above.
    expect(validatePlacement('wall', { x: 0.4, z: 0.6 }, grid, [wall], []).failure).toBe('BLOCKED');
    expect(validatePlacement('wall', { x: 0.4, z: 3.2 }, grid, [wall], [], true)).toMatchObject({ valid: true });
  });
});
