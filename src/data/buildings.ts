import type { BuildingTypeId } from '../game/types/ids';
import type { ResourceCost } from '../game/types/simulation';

export interface BuildingConfig {
  readonly id: BuildingTypeId;
  readonly label: string;
  readonly maxHp: number;
  readonly footprint: readonly [number, number];
  readonly cost: ResourceCost;
  readonly constructionTime: number;
  readonly capacityContribution: number;
  /**
   * Agent Capacity the structure occupies while it stands. A synthesis plant is crewed: it takes
   * slots the colony could otherwise spend on Agents, which is what stops manufactured resources
   * from being strictly better than mining. Zero for everything that is not a plant.
   */
  readonly capacityUse: number;
  readonly vision: number;
  readonly acceptsDeposits: boolean;
  readonly attackDamage: number;
  readonly attackRange: number;
  readonly attackCooldown: number;
  /** A Gate is a doorway: it has health and blocks placement, but never blocks pathing. */
  readonly blocksNavigation: boolean;
  /**
   * Clearance kept around the footprint, in world units. Village pieces use zero so a wall
   * line is continuous and structures can be packed flush against each other.
   */
  readonly clearance: number;
}

/**
 * Costs deliberately spread across all three resources.
 *
 * Player report: "the map is vast but we don't have as much resources, when building a city",
 * sent with 106 Matter next to 830 Energy and 253 Data. Supply was never the problem -- a seeded
 * map holds roughly 7800 Matter per faction and a ten-structure walled city costs about 1200 --
 * demand was: almost everything was priced in Matter alone, so Matter was the only wall a builder
 * ever hit while the other two piled up unspent. Defence leans on Energy, the deep tech leans on
 * Data, and a synthesis plant is bought with the resource it converts *from*, so a colony that has
 * run its Matter down can still afford the thing that makes Matter.
 */
export const BUILDINGS = {
  // The Core is the match: it holds long enough for a player to see the alarm, look, and answer,
  // and it defends itself while they do. At 1500 HP and unarmed, a first assault deleted it in
  // about seven seconds -- measured, a passive colony went from first damage to defeat in under
  // thirty -- which is not a strategy game, it is a countdown.
  core: { id: 'core', label: 'Core', maxHp: 3200, footprint: [4, 4], cost: {}, constructionTime: 0, capacityContribution: 8, capacityUse: 0, vision: 14, acceptsDeposits: true, attackDamage: 9, attackRange: 11, attackCooldown: 1.6, blocksNavigation: true, clearance: 0.35 },
  relay: { id: 'relay', label: 'Relay Node', maxHp: 450, footprint: [2, 2], cost: { matter: 70, energy: 40 }, constructionTime: 8, capacityContribution: 5, capacityUse: 0, vision: 8, acceptsDeposits: false, attackDamage: 0, attackRange: 0, attackCooldown: 1, blocksNavigation: true, clearance: 0.35 },
  fabricator: { id: 'fabricator', label: 'Fabricator', maxHp: 800, footprint: [4, 3], cost: { matter: 140, energy: 110 }, constructionTime: 12, capacityContribution: 0, capacityUse: 0, vision: 9, acceptsDeposits: false, attackDamage: 0, attackRange: 0, attackCooldown: 1, blocksNavigation: true, clearance: 0.35 },
  habitat: { id: 'habitat', label: 'Habitat', maxHp: 520, footprint: [3, 3], cost: { matter: 60, energy: 30 }, constructionTime: 6, capacityContribution: 5, capacityUse: 0, vision: 7, acceptsDeposits: false, attackDamage: 0, attackRange: 0, attackCooldown: 1, blocksNavigation: true, clearance: 0 },
  depot: { id: 'depot', label: 'Storage Depot', maxHp: 600, footprint: [3, 2], cost: { matter: 75, energy: 40 }, constructionTime: 7, capacityContribution: 0, capacityUse: 0, vision: 8, acceptsDeposits: true, attackDamage: 0, attackRange: 0, attackCooldown: 1, blocksNavigation: true, clearance: 0 },
  wall: { id: 'wall', label: 'Barrier Wall', maxHp: 1100, footprint: [4, 1], cost: { matter: 10 }, constructionTime: 4, capacityContribution: 0, capacityUse: 0, vision: 2, acceptsDeposits: false, attackDamage: 0, attackRange: 0, attackCooldown: 1, blocksNavigation: true, clearance: 0 },
  gate: { id: 'gate', label: 'Gate', maxHp: 700, footprint: [2, 1], cost: { matter: 40, energy: 10 }, constructionTime: 4, capacityContribution: 0, capacityUse: 0, vision: 4, acceptsDeposits: false, attackDamage: 0, attackRange: 0, attackCooldown: 1, blocksNavigation: false, clearance: 0 },
  outpost: { id: 'outpost', label: 'Field Outpost', maxHp: 650, footprint: [3, 3], cost: { matter: 85, energy: 55 }, constructionTime: 9, capacityContribution: 0, capacityUse: 0, vision: 18, acceptsDeposits: true, attackDamage: 0, attackRange: 0, attackCooldown: 1, blocksNavigation: true, clearance: 0.35 },
  // A Generation I unlock, and priced for a colony that is still building its first structures:
  // fortifying has to be something a player can choose *while* they build a city, not a reward for
  // having already finished one. Nothing else in the roster answers a raid.
  turret: { id: 'turret', label: 'Zap Turret', maxHp: 700, footprint: [2, 2], cost: { matter: 75, energy: 80 }, constructionTime: 10, capacityContribution: 0, capacityUse: 0, vision: 14, acceptsDeposits: false, attackDamage: 22, attackRange: 10, attackCooldown: 1.15, blocksNavigation: true, clearance: 0 },
  reclaimer: { id: 'reclaimer', label: 'Reclamation Plant', maxHp: 620, footprint: [3, 3], cost: { matter: 60, energy: 190 }, constructionTime: 11, capacityContribution: 0, capacityUse: 2, vision: 8, acceptsDeposits: false, attackDamage: 0, attackRange: 0, attackCooldown: 1, blocksNavigation: true, clearance: 0.35 },
  datalab: { id: 'datalab', label: 'Cognition Lab', maxHp: 700, footprint: [3, 3], cost: { matter: 120, energy: 240 }, constructionTime: 14, capacityContribution: 0, capacityUse: 3, vision: 9, acceptsDeposits: false, attackDamage: 0, attackRange: 0, attackCooldown: 1, blocksNavigation: true, clearance: 0.35 },
  foundry: { id: 'foundry', label: 'Heavy Foundry', maxHp: 1200, footprint: [5, 4], cost: { matter: 300, energy: 240, data: 120 }, constructionTime: 18, capacityContribution: 0, capacityUse: 0, vision: 10, acceptsDeposits: false, attackDamage: 0, attackRange: 0, attackCooldown: 1, blocksNavigation: true, clearance: 0.35 },
} as const satisfies Readonly<Record<BuildingTypeId, BuildingConfig>>;

/**
 * Default navigation padding around a building footprint. Village pieces override it to zero
 * through `clearance`. Blocking and unblocking must always use `footprintPadding`.
 */
export const BUILDING_FOOTPRINT_PADDING = 0.35;

/** Footprint in world units, with the optional quarter-turn applied. */
export function footprintFor(kind: BuildingTypeId, rotated = false): { readonly x: number; readonly z: number } {
  const [x, z] = BUILDINGS[kind].footprint;
  return rotated ? { x: z, z: x } : { x, z };
}

/** The single source of truth for how much room a building takes on the navigation grid. */
export function footprintPadding(kind: BuildingTypeId): number {
  return BUILDINGS[kind].clearance;
}

/** Placement clearance between two buildings: a flush village piece relaxes it for both. */
export function placementClearance(a: BuildingTypeId, b: BuildingTypeId): number {
  return Math.min(BUILDINGS[a].clearance, BUILDINGS[b].clearance);
}

/**
 * How much room a building must leave around a resource node.
 *
 * A node's harvestable body is about two units across, and a Worker has to be able to stand next
 * to it. Ordinary structures keep a wide berth so they never wall a deposit off from the colony
 * that needs it. A wall or gate is a thin barrier a player runs *past* a deposit on the way round
 * their base -- holding it three units clear made it impossible to enclose a colony that had a
 * deposit anywhere near its edge, which is most of them.
 */
export function resourceClearance(kind: BuildingTypeId): number {
  return BUILDINGS[kind].clearance === 0 ? 0 : 0.5;
}
