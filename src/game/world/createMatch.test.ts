import { describe, expect, it } from 'vitest';
import { ownedBy } from '../entities/core/ownership';
import { findPath } from '../navigation/AStar';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { createMatch, readScenarioFromLocation } from './createMatch';
import { MAP_BOUNDS, WORLD_OBSTACLES } from './map';

describe('economy match', () => {
  it('creates deterministic, equivalent factions with nearby reachable resources', () => {
    const first = createMatch({ seed: 42 });
    const second = createMatch({ seed: 42 });
    expect(second).toEqual(first);
    for (const team of ['player', 'enemy'] as const) {
      expect(ownedBy(first.buildings, team).filter((building) => building.kind === 'core')).toHaveLength(1);
      expect(ownedBy(first.units, team).filter((unit) => unit.kind === 'worker')).toHaveLength(3);
      // Home cluster (2 Matter, 1 Energy) plus an expansion cluster (1 Matter, 1 Energy).
      expect(first.resources.filter((node) => node.id.startsWith(team))).toHaveLength(5);
    }
    const grid = new NavigationGrid(MAP_BOUNDS.minX, MAP_BOUNDS.minZ, MAP_BOUNDS.maxX, MAP_BOUNDS.maxZ);
    WORLD_OBSTACLES.forEach((obstacle) => grid.setBlockedRect(obstacle.center, obstacle.size, true, 0.65));
    first.buildings.forEach((building) => grid.setBlockedRect(building.position, building.footprint, true, 0.35));
    for (const team of ['player', 'enemy'] as const) {
      const worker = first.units.find((unit) => unit.team === team)!;
      const home = first.resources.filter((resource) => /^\w+-(matter-1|matter-2|energy-1)$/.test(resource.id) && resource.id.startsWith(team));
      expect(home).toHaveLength(3);
      for (const node of home) {
        expect(Math.hypot(worker.position.x - node.position.x, worker.position.z - node.position.z)).toBeLessThan(16);
        expect(findPath(grid, worker.position, node.position).length).toBeGreaterThan(0);
      }
      // The contested middle is reachable from both bases.
      for (const node of first.resources.filter((resource) => resource.id.startsWith('middle'))) {
        expect(findPath(grid, worker.position, node.position).length).toBeGreaterThan(0);
      }
    }
    expect(first.startingBalances).toEqual({ matter: 25, energy: 20, data: 0, capacity: 8 });
  });
});

describe('battle scenario selection', () => {
  it('keeps the shipping economy opening by default and mirrors the debug armies on request', () => {
    expect(readScenarioFromLocation('')).toBe('economy');
    expect(readScenarioFromLocation('?scenario=battle')).toBe('battle');
    expect(createMatch({ seed: 7 }).units.every((unit) => unit.kind === 'worker')).toBe(true);

    const battle = createMatch({ seed: 7, scenario: 'battle' });
    expect(createMatch({ seed: 7, scenario: 'battle' })).toEqual(battle);
    for (const team of ['player', 'enemy'] as const) {
      expect(ownedBy(battle.units, team).filter((unit) => unit.kind === 'striker')).toHaveLength(6);
      expect(ownedBy(battle.buildings, team).filter((building) => building.kind === 'core')).toHaveLength(1);
    }
    const playerStrikers = ownedBy(battle.units, 'player').filter((unit) => unit.kind === 'striker');
    const enemyStrikers = ownedBy(battle.units, 'enemy').filter((unit) => unit.kind === 'striker');
    expect(playerStrikers[0]!.maxHp).toBe(enemyStrikers[0]!.maxHp);
    expect(playerStrikers[0]!.combat.damage).toBe(enemyStrikers[0]!.combat.damage);
  });
});
