import { RESOURCES, STARTING_ECONOMY } from '../../data/resources';
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

export function createEconomyScenario(seed = 20_260_902): EconomyScenario {
  const wobble = ((seed % 7) - 3) * 0.15;
  const buildings = [createCore(entityId('player-core'), 'player', { x: -25, z: 10 }), createCore(entityId('enemy-core'), 'enemy', { x: 25, z: -10 })];
  const units: UnitEntity[] = [];
  for (const [team, x, z] of [['player', -21, 10], ['enemy', 21, -10]] as const) {
    for (let index = 0; index < 3; index += 1) units.push(createWorkerEntity(`${team}-worker-${index + 1}`, team, { x, z: z + (index - 1) * 1.5 }));
  }
  const resources = [
    createResourceNode(entityId('player-matter'), 'matter', { x: -19, z: 16 + wobble }, RESOURCES.matter.capacity),
    createResourceNode(entityId('player-energy'), 'energy', { x: -26, z: 18 - wobble }, RESOURCES.energy.capacity),
    createResourceNode(entityId('enemy-matter'), 'matter', { x: 19, z: -16 - wobble }, RESOURCES.matter.capacity),
    createResourceNode(entityId('enemy-energy'), 'energy', { x: 26, z: -18 + wobble }, RESOURCES.energy.capacity),
  ];
  return { seed, units, buildings, resources, startingBalances: STARTING_ECONOMY };
}
