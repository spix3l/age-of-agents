import { STARTING_ECONOMY, RESOURCES } from '../../data/resources';
import { createCore } from '../entities/buildings/Core';
import { createResourceNode } from '../entities/resources/ResourceNode';
import { entityId } from '../types/ids';
import type { BuildingEntity, Team, UnitEntity } from '../types/simulation';
import { createUnitEntity, type EconomyScenario } from './economy';

/**
 * Deterministic two-army fixture for the Day 4 battle gate and headless combat tests.
 * Both factions are mirrored so an outcome reflects orders, never a starting advantage.
 */
export function createBattleScenario(seed = 20_260_904, strikersPerSide = 6): EconomyScenario {
  const buildings: BuildingEntity[] = [
    createCore(entityId('player-core'), 'player', { x: -25, z: 10 }),
    createCore(entityId('enemy-core'), 'enemy', { x: 25, z: -10 }),
  ];
  const units: UnitEntity[] = [];
  for (const [team, originX, originZ, facing] of [['player', -8, 4, 1], ['enemy', 8, -4, -1]] as const) {
    for (let index = 0; index < strikersPerSide; index += 1) {
      const row = Math.floor(index / 3);
      units.push(createUnitEntity(
        `${team}-striker-${index + 1}`,
        'striker',
        team as Exclude<Team, 'neutral'>,
        { x: originX - facing * row * 1.6, z: originZ + ((index % 3) - 1) * 1.7 },
      ));
    }
    for (let index = 0; index < 2; index += 1) {
      units.push(createUnitEntity(
        `${team}-worker-${index + 1}`,
        'worker',
        team as Exclude<Team, 'neutral'>,
        { x: originX - facing * 5, z: originZ + (index - 0.5) * 1.5 },
      ));
    }
  }
  const resources = [
    createResourceNode(entityId('player-matter'), 'matter', { x: -19, z: 16 }, RESOURCES.matter.capacity),
    createResourceNode(entityId('player-energy'), 'energy', { x: -26, z: 18 }, RESOURCES.energy.capacity),
    createResourceNode(entityId('enemy-matter'), 'matter', { x: 19, z: -16 }, RESOURCES.matter.capacity),
    createResourceNode(entityId('enemy-energy'), 'energy', { x: 26, z: -18 }, RESOURCES.energy.capacity),
  ];
  return { seed, units, buildings, resources, startingBalances: STARTING_ECONOMY };
}
