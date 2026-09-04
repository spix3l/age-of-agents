import { RESOURCES, STARTING_ECONOMY } from '../../data/resources';
import { UNITS } from '../../data/units';
import { createCore } from '../entities/buildings/Core';
import { createResourceNode, type ResourceNodeEntity } from '../entities/resources/ResourceNode';
import { entityId } from '../types/ids';
import type { BuildingEntity, Team, UnitEntity, Vec2 } from '../types/simulation';
import { Random } from '../util/Random';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { MAP_BOUNDS, START_POSITIONS, WORLD_OBSTACLES } from '../world/map';
import { gatherApproachCell } from '../systems/GatheringSystem';

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
/** A resource cluster the generator lays down, described in the player's half of the map. */
interface Cluster {
  readonly key: string;
  /** Distance from the start position, and bearing in radians from the start toward the middle. */
  readonly reach: number;
  readonly spread: number;
  readonly matter: number;
  readonly energy: number;
  readonly data: number;
  /** Multiplies node capacity: an exposed cluster is worth more than a safe one. */
  readonly richness: number;
}

/**
 * Builds one match's resource layout.
 *
 * Everything is generated for the player's half and then rotated 180 degrees about the origin for
 * the opponent, which is what makes a seeded map provably fair: both factions get the same
 * clusters at the same distances and bearings, mirrored. The contested middle is laid out in
 * rotational pairs for the same reason, with a single node allowed exactly at the centre.
 */
/**
 * `solo` lays the same world down without the opposing colony: the mirrored deposits stay, so the
 * whole map is worth exploring, but nobody starts in the far corner. It is what Freestyle plays.
 */
export function createEconomyScenario(seed = 20_260_902, solo = false): EconomyScenario {
  const random = new Random(seed);
  // A copy of the match's navigation grid, so a generated site can be checked for a walkable
  // approach before it is committed. A node inside a ridge is harvestable by nobody and silently
  // starves every Worker that ranks it closest.
  const grid = new NavigationGrid(MAP_BOUNDS.minX, MAP_BOUNDS.minZ, MAP_BOUNDS.maxX, MAP_BOUNDS.maxZ);
  for (const obstacle of WORLD_OBSTACLES) grid.setBlockedRect(obstacle.center, obstacle.size, true, 0.65);

  const buildings: BuildingEntity[] = [];
  const units: UnitEntity[] = [];
  const resources: ResourceNodeEntity[] = [];

  const origin = START_POSITIONS.player;
  // Bearing from the player's corner toward the middle of the map. Every cluster is placed
  // relative to it, so a rotated map still puts the home cluster behind the colony.
  const inward = Math.atan2(-origin.z, -origin.x);

  const clusters: Cluster[] = [
    // Home: enough of all three to open, evolve once, and start a village without leaving the
    // basin. Always present, always close, or an opening is not viable.
    { key: 'home', reach: random.range(10, 13), spread: random.range(0.5, 0.75), matter: 2, energy: 1, data: 1, richness: 1 },
    // Mid: the expansion worth walking to and worth defending.
    { key: 'mid', reach: random.range(38, 50), spread: random.range(0.45, 0.75), matter: 2, energy: 1, data: 1, richness: 1.25 },
    // Wing: far, open ground that rewards scouting the big map.
    { key: 'wing', reach: random.range(58, 74), spread: random.range(0.8, 1.15), matter: random.integer(1, 3), energy: 1, data: 0, richness: 1.5 },
  ];

  const capacityFor = (type: 'matter' | 'energy' | 'data', richness: number): number =>
    Math.round(RESOURCES[type].capacity * richness * random.range(0.85, 1.2));

  const MARGIN = 6;
  /** A site is usable only if a Worker can stand next to it, and its mirror can too. */
  const usable = (at: Vec2): boolean => {
    if (at.x < MAP_BOUNDS.minX + MARGIN || at.x > MAP_BOUNDS.maxX - MARGIN) return false;
    if (at.z < MAP_BOUNDS.minZ + MARGIN || at.z > MAP_BOUNDS.maxZ - MARGIN) return false;
    const probe = (position: Vec2): boolean =>
      gatherApproachCell(grid, { position } as Parameters<typeof gatherApproachCell>[1]) !== null;
    return probe(at) && probe({ x: -at.x, z: -at.z });
  };

  /**
   * Nudges a site until both it and its mirror are harvestable. Terrain is handcrafted and the
   * layout is generated, so some draws land inside a ridge; searching outward from the intended
   * spot keeps the cluster's shape rather than discarding the node.
   */
  const settle = (at: Vec2): Vec2 | null => {
    if (usable(at)) return at;
    for (let ring = 1; ring <= 8; ring += 1) {
      for (let step = 0; step < 8; step += 1) {
        const angle = (step / 8) * Math.PI * 2;
        const candidate = { x: at.x + Math.cos(angle) * ring * 2.5, z: at.z + Math.sin(angle) * ring * 2.5 };
        if (usable(candidate)) return candidate;
      }
    }
    return null;
  };

  /** Places one cluster for both factions at once, mirrored through the origin. */
  const placeCluster = (cluster: Cluster): void => {
    const nodes: { type: 'matter' | 'energy' | 'data'; at: Vec2 }[] = [];
    const kinds: ('matter' | 'energy' | 'data')[] = [
      ...Array.from({ length: cluster.matter }, () => 'matter' as const),
      ...Array.from({ length: cluster.energy }, () => 'energy' as const),
      ...Array.from({ length: cluster.data }, () => 'data' as const),
    ];
    for (const [index, type] of kinds.entries()) {
      const bearing = inward + cluster.spread * ((index / Math.max(1, kinds.length - 1)) - 0.5) * 2;
      // The home cluster is the opening economy: it varies, but never far enough to change
      // whether the opening is viable. Outer clusters are free to swing much more.
      const swing = cluster.key === 'home' ? 2 : 4;
      const distance = cluster.reach + random.range(-swing, swing);
      nodes.push({ type, at: { x: origin.x + Math.cos(bearing) * distance, z: origin.z + Math.sin(bearing) * distance } });
    }
    for (const [index, node] of nodes.entries()) {
      const at = settle(node.at);
      if (!at) continue;
      const capacity = capacityFor(node.type, cluster.richness);
      resources.push(createResourceNode(entityId(`player-${cluster.key}-${node.type}-${index}`), node.type, at, capacity));
      // The opponent's copy: the same node rotated 180 degrees about the map's centre.
      resources.push(createResourceNode(
        entityId(`enemy-${cluster.key}-${node.type}-${index}`), node.type,
        { x: -at.x, z: -at.z }, capacity,
      ));
    }
  };

  for (const cluster of clusters) placeCluster(cluster);

  // Contested middle: rotational pairs, so neither side is nearer to any of it.
  const contested = random.integer(3, 6);
  for (let index = 0; index < contested; index += 1) {
    const bearing = random.next() * Math.PI * 2;
    const distance = random.range(18, 54);
    const type = index % 3 === 2 ? 'data' : index % 2 === 0 ? 'matter' : 'energy';
    const at = settle({ x: Math.cos(bearing) * distance, z: Math.sin(bearing) * distance });
    if (!at) continue;
    const capacity = capacityFor(type, 1.6);
    resources.push(createResourceNode(entityId(`middle-${type}-${index}-a`), type, at, capacity));
    resources.push(createResourceNode(entityId(`middle-${type}-${index}-b`), type, { x: -at.x, z: -at.z }, capacity));
  }
  // One prize dead centre, equidistant by construction.
  resources.push(createResourceNode(entityId('middle-data-prize'), 'data', { x: 0, z: 0 }, RESOURCES.data.capacity * 3));

  for (const team of ['player', 'enemy'] as const) {
    if (solo && team === 'enemy') continue;
    const start = START_POSITIONS[team];
    const facing = team === 'player' ? 1 : -1;
    buildings.push(createCore(entityId(`${team}-core`), team, start));
    for (let index = 0; index < 3; index += 1) {
      units.push(createWorkerEntity(`${team}-worker-${index + 1}`, team, {
        x: start.x + facing * 4,
        z: start.z - facing * (index - 1) * 1.6,
      }));
    }
  }

  return { seed, units, buildings, resources, startingBalances: STARTING_ECONOMY };
}
