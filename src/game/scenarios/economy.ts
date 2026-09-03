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
      autoAcquires: config.autoAcquires, targetId: null, lastAttackerId: null, ordered: false,
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
    // Home cluster: enough of all three resources to open, evolve once, and start a village
    // without leaving the basin. The archive is close so Generation II is a real early choice.
    resources.push(
      createResourceNode(entityId(`${team}-matter-1`), 'matter', { x: origin.x + inward * 8, z: origin.z - inward * 8 + wobble }, RESOURCES.matter.capacity),
      createResourceNode(entityId(`${team}-matter-2`), 'matter', { x: origin.x - inward * 5, z: origin.z - inward * 9 - wobble }, RESOURCES.matter.capacity),
      createResourceNode(entityId(`${team}-energy-1`), 'energy', { x: origin.x + inward * 12, z: origin.z - inward * 2 - wobble }, RESOURCES.energy.capacity),
      createResourceNode(entityId(`${team}-data-1`), 'data', { x: origin.x + inward * 5, z: origin.z - inward * 13 + wobble }, RESOURCES.data.capacity),
    );
    // Expansion cluster: richer, but out in the open where an Outpost pays for itself.
    resources.push(
      createResourceNode(entityId(`${team}-matter-3`), 'matter', { x: origin.x + inward * 34, z: origin.z - inward * 26 }, RESOURCES.matter.capacity),
      createResourceNode(entityId(`${team}-matter-4`), 'matter', { x: origin.x + inward * 41, z: origin.z - inward * 20 + wobble }, RESOURCES.matter.capacity),
      createResourceNode(entityId(`${team}-energy-2`), 'energy', { x: origin.x + inward * 38, z: origin.z - inward * 32 - wobble }, RESOURCES.energy.capacity),
      createResourceNode(entityId(`${team}-data-2`), 'data', { x: origin.x + inward * 45, z: origin.z - inward * 9 - wobble }, RESOURCES.data.capacity),
    );
    // Wing expansion: the far, undefended ground that rewards scouting the big map.
    resources.push(
      createResourceNode(entityId(`${team}-matter-5`), 'matter', { x: origin.x + inward * 16, z: origin.z - inward * 52 }, RESOURCES.matter.capacity),
      createResourceNode(entityId(`${team}-energy-3`), 'energy', { x: origin.x + inward * 62, z: origin.z - inward * 46 + wobble }, RESOURCES.energy.capacity),
    );
  }

  // Contested middle: the deposits both factions have to fight over.
  resources.push(
    createResourceNode(entityId('middle-matter-north'), 'matter', { x: -26, z: 48 }, RESOURCES.matter.capacity),
    createResourceNode(entityId('middle-matter-south'), 'matter', { x: 27, z: -49 }, RESOURCES.matter.capacity),
    createResourceNode(entityId('middle-matter-east'), 'matter', { x: 46, z: 24 }, RESOURCES.matter.capacity),
    createResourceNode(entityId('middle-matter-west'), 'matter', { x: -47, z: -25 }, RESOURCES.matter.capacity),
    createResourceNode(entityId('middle-energy-north'), 'energy', { x: 36, z: 30 }, RESOURCES.energy.capacity),
    createResourceNode(entityId('middle-energy-south'), 'energy', { x: -37, z: -31 }, RESOURCES.energy.capacity),
    createResourceNode(entityId('middle-data-north'), 'data', { x: -8, z: 6 }, RESOURCES.data.capacity),
    createResourceNode(entityId('middle-data-south'), 'data', { x: 9, z: -7 }, RESOURCES.data.capacity),
    createResourceNode(entityId('middle-data'), 'data', { x: 2, z: 2 }, RESOURCES.data.capacity * 2),
  );

  return { seed, units, buildings, resources, startingBalances: STARTING_ECONOMY };
}
