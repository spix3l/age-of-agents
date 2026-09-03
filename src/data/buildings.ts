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
  readonly vision: number;
  readonly acceptsDeposits: boolean;
  readonly attackDamage: number;
  readonly attackRange: number;
  readonly attackCooldown: number;
}

export const BUILDINGS = {
  core: { id: 'core', label: 'Core', maxHp: 1500, footprint: [4, 4], cost: {}, constructionTime: 0, capacityContribution: 8, vision: 14, acceptsDeposits: true, attackDamage: 0, attackRange: 0, attackCooldown: 1 },
  relay: { id: 'relay', label: 'Relay Node', maxHp: 450, footprint: [2, 2], cost: { matter: 80, energy: 20 }, constructionTime: 8, capacityContribution: 5, vision: 8, acceptsDeposits: false, attackDamage: 0, attackRange: 0, attackCooldown: 1 },
  fabricator: { id: 'fabricator', label: 'Fabricator', maxHp: 800, footprint: [4, 3], cost: { matter: 160, energy: 80 }, constructionTime: 12, capacityContribution: 0, vision: 9, acceptsDeposits: false, attackDamage: 0, attackRange: 0, attackCooldown: 1 },
  wall: { id: 'wall', label: 'Barrier Wall', maxHp: 950, footprint: [2, 1], cost: { matter: 25 }, constructionTime: 3, capacityContribution: 0, vision: 2, acceptsDeposits: false, attackDamage: 0, attackRange: 0, attackCooldown: 1 },
  outpost: { id: 'outpost', label: 'Field Outpost', maxHp: 650, footprint: [3, 3], cost: { matter: 100, energy: 35 }, constructionTime: 9, capacityContribution: 0, vision: 18, acceptsDeposits: true, attackDamage: 0, attackRange: 0, attackCooldown: 1 },
  turret: { id: 'turret', label: 'Zap Turret', maxHp: 700, footprint: [2, 2], cost: { matter: 125, energy: 75 }, constructionTime: 10, capacityContribution: 0, vision: 14, acceptsDeposits: false, attackDamage: 22, attackRange: 10, attackCooldown: 1.15 },
  foundry: { id: 'foundry', label: 'Heavy Foundry', maxHp: 1200, footprint: [5, 4], cost: { matter: 360, energy: 240, data: 60 }, constructionTime: 18, capacityContribution: 0, vision: 10, acceptsDeposits: false, attackDamage: 0, attackRange: 0, attackCooldown: 1 },
} as const satisfies Readonly<Record<BuildingTypeId, BuildingConfig>>;

/** Navigation padding applied around every building footprint. Blocking and unblocking must match. */
export const BUILDING_FOOTPRINT_PADDING = 0.35;
