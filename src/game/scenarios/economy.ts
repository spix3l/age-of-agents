import { RESOURCES, STARTING_ECONOMY } from '../../data/resources';
import { START_POSITIONS } from '../world/map';
import { UNITS } from '../../data/units';
import { createCore } from '../entities/buildings/Core';
import { createResourceNode, type ResourceNodeEntity } from '../entities/resources/ResourceNode';
import { entityId } from '../types/ids';
import type { BuildingEntity, Team, UnitEntity, Vec2 } from '../types/simulation';

export interface EconomyScenario {
  readonly seed: number;
  readonly units: readonly UnitEntity[];
  readonly buildings: readonly BuildingEntity[];
  readonly resources: readonly ResourceNodeEntity[];
  readonly startingBalances: typeof STARTING_ECONOMY;
}

export function createUnitEntity(id: string, kind: UnitEntity['kind'], team: Exclude<Team, 'neutral'>, position: Vec2): UnitEntity {
  const config = UNITS[kind];
  return {
    id: entityId(id), kind, team, alive: true,
    position: { ...position }, previousPosition: { ...position },
    hp: config.maxHp, maxHp: config.maxHp, radius: config.radius, movementSpeed: config.movementSpeed,
    path: [], pathIndex: 0, destination: null, stuckSeconds: 0, repathCount: 0, selected: false,
    activity: 'Idle', cargo: { type: null, amount: 0 }, gatherOrder: null, buildOrder: null, automation: null,
    combat: {
      damage: config.attackDamage, range: config.attackRange, cooldownTime: config.attackCooldown, vision: config.vision,
      autoAcquires: config.autoAcquires, targetId: null, ordered: false,
      cooldown: 0, acquireCooldown: 0, repathCooldown: 0,
    },
  };
}

export function createWorkerEntity(id: string, team: Exclude<Team, 'neutral'>, position: Vec2): UnitEntity {
  return createUnitEntity(id, 'worker', team, position);
}

/**
 * Mirrored opening on the large map: each faction owns a home cluster of deposits, a second
 * expansion cluster it must walk to, and both contest the shared middle field.
 */
export function createEconomyScenario(seed = 20_260_902): EconomyScenario {
  const wobble = ((seed % 7) - 3) * 0.15;
  const buildings: BuildingEntity[] = [];
  const units: UnitEntity[] = [];
  const resources: ResourceNodeEntity[] = [];

  for (const team of ['player', 'enemy'] as const) {
    const origin = START_POSITIONS[team];
    const inward = team === 'player' ? 1 : -1;
    buildings.push(createCore(entityId(`${team}-core`), team, origin));
    for (let index = 0; index < 3; index += 1) {
      units.push(createWorkerEntity(`${team}-worker-${index + 1}`, team, {
        x: origin.x + inward * 4,
        z: origin.z - inward * (index - 1) * 1.6,
      }));
    }
    // Home cluster: two Matter deposits and one Energy vent within a short walk of the Core.
    resources.push(
      createResourceNode(entityId(`${team}-matter-1`), 'matter', { x: origin.x + inward * 7, z: origin.z - inward * 7 + wobble }, RESOURCES.matter.capacity),
      createResourceNode(entityId(`${team}-matter-2`), 'matter', { x: origin.x - inward * 6, z: origin.z - inward * 9 - wobble }, RESOURCES.matter.capacity),
      createResourceNode(entityId(`${team}-energy-1`), 'energy', { x: origin.x + inward * 10, z: origin.z - inward * 2 - wobble }, RESOURCES.energy.capacity),
    );
    // Expansion cluster: richer, but out in the open and closer to the middle.
    resources.push(
      createResourceNode(entityId(`${team}-matter-3`), 'matter', { x: origin.x + inward * 21, z: origin.z - inward * 18 }, RESOURCES.matter.capacity),
      createResourceNode(entityId(`${team}-energy-2`), 'energy', { x: origin.x + inward * 25, z: origin.z - inward * 13 + wobble }, RESOURCES.energy.capacity),
    );
  }

  // Contested middle: the deposits both factions have to fight over.
  resources.push(
    createResourceNode(entityId('middle-matter-north'), 'matter', { x: -13, z: 24 }, RESOURCES.matter.capacity),
    createResourceNode(entityId('middle-matter-south'), 'matter', { x: 14, z: -25 }, RESOURCES.matter.capacity),
    createResourceNode(entityId('middle-energy-north'), 'energy', { x: 18, z: 15 }, RESOURCES.energy.capacity),
    createResourceNode(entityId('middle-energy-south'), 'energy', { x: -19, z: -16 }, RESOURCES.energy.capacity),
  );

  return { seed, units, buildings, resources, startingBalances: STARTING_ECONOMY };
}
