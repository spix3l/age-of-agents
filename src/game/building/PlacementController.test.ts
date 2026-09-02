import { describe, expect, it, vi } from 'vitest';
import { createCore } from '../entities/buildings/Core';
import { createResourceNode } from '../entities/resources/ResourceNode';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { entityId } from '../types/ids';
import { PlacementController, validatePlacement } from './PlacementController';

describe('building placement', () => {
  const grid = new NavigationGrid(0, 0, 30, 30);
  const core = createCore(entityId('placement-core'), 'player', { x: 6, z: 6 });
  const resource = createResourceNode(entityId('placement-matter'), 'matter', { x: 20, z: 20 }, 100);

  it('accepts open terrain and rejects boundaries, blockers, resources, and buildings', () => {
    grid.setBlockedRect({ x: 14, z: 14 }, { x: 3, z: 3 }, true);
    expect(validatePlacement('relay', { x: 10, z: 20 }, grid, [core], [resource])).toMatchObject({ valid: true, position: { x: 10.5, z: 20.5 } });
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
      validate: (_type, position) => ({ valid, position, failure: valid ? undefined : 'BLOCKED' }),
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
});
