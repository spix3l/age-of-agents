import { describe, expect, it } from 'vitest';
import { ownedBy } from '../entities/core/ownership';
import { findPath } from '../navigation/AStar';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { createMatch } from './createMatch';
import { MAP_BOUNDS, WORLD_OBSTACLES } from './map';

describe('economy match', () => {
  it('creates deterministic, equivalent factions with nearby reachable resources', () => {
    const first = createMatch({ seed: 42 });
    const second = createMatch({ seed: 42 });
    expect(second).toEqual(first);
    for (const team of ['player', 'enemy'] as const) {
      expect(ownedBy(first.buildings, team).filter((building) => building.kind === 'core')).toHaveLength(1);
      expect(ownedBy(first.units, team).filter((unit) => unit.kind === 'worker')).toHaveLength(3);
      expect(first.resources.filter((node) => node.id.startsWith(team))).toHaveLength(2);
    }
    const grid = new NavigationGrid(MAP_BOUNDS.minX, MAP_BOUNDS.minZ, MAP_BOUNDS.maxX, MAP_BOUNDS.maxZ);
    WORLD_OBSTACLES.forEach((obstacle) => grid.setBlockedRect(obstacle.center, obstacle.size, true, 0.65));
    first.buildings.forEach((building) => grid.setBlockedRect(building.position, building.footprint, true, 0.35));
    for (const team of ['player', 'enemy'] as const) {
      const worker = first.units.find((unit) => unit.team === team)!;
      for (const node of first.resources.filter((resource) => resource.id.startsWith(team))) {
        expect(Math.hypot(worker.position.x - node.position.x, worker.position.z - node.position.z)).toBeLessThan(12);
        expect(findPath(grid, worker.position, node.position).length).toBeGreaterThan(0);
      }
    }
    expect(first.startingBalances).toEqual({ matter: 25, energy: 20, data: 0, capacity: 8 });
  });
});
