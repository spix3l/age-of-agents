import type { ResourceCost } from '../game/types/simulation';
import type { UnitTypeId } from '../game/types/ids';

export interface UnitConfig {
  readonly id: UnitTypeId;
  readonly label: string;
  readonly maxHp: number;
  readonly movementSpeed: number;
  readonly radius: number;
  readonly capacityCost: number;
  readonly cost: ResourceCost;
  readonly productionTime: number;
  readonly attackDamage: number;
  readonly attackRange: number;
  readonly attackCooldown: number;
  readonly vision: number;
  readonly autoAcquires: boolean;
}

/**
 * Agent costs, priced across all three resources for the same reason the structures are: a colony
 * that only ever spends Matter banks Energy and Data it can never use. The Worker stays pure
 * Matter -- the opening has nothing else yet -- and everything above it leans progressively harder
 * on Energy, with Data reserved for the Generation III roster.
 */
export const UNITS = {
  worker: {
    id: 'worker', label: 'Worker Agent', maxHp: 70, movementSpeed: 5.2,
    radius: 0.45, capacityCost: 1, cost: { matter: 45 }, productionTime: 6,
    attackDamage: 7, attackRange: 1.6, attackCooldown: 1.1, vision: 9, autoAcquires: false,
  },
  striker: {
    id: 'striker', label: 'Striker', maxHp: 120, movementSpeed: 4,
    radius: 0.52, capacityCost: 1, cost: { matter: 55, energy: 30 }, productionTime: 8,
    attackDamage: 12, attackRange: 2.5, attackCooldown: 0.9, vision: 11, autoAcquires: true,
  },
  ranger: {
    id: 'ranger', label: 'Ranger', maxHp: 72, movementSpeed: 4.5,
    radius: 0.46, capacityCost: 1, cost: { matter: 70, energy: 50, data: 10 }, productionTime: 10,
    attackDamage: 18, attackRange: 8, attackCooldown: 1.45, vision: 14, autoAcquires: true,
  },
  scout: {
    id: 'scout', label: 'Scout Drone', maxHp: 48, movementSpeed: 7.2,
    radius: 0.4, capacityCost: 1, cost: { matter: 45, energy: 60 }, productionTime: 8,
    attackDamage: 4, attackRange: 3.5, attackCooldown: 1.1, vision: 20, autoAcquires: false,
  },
  titan: {
    id: 'titan', label: 'Titan', maxHp: 620, movementSpeed: 2.5,
    radius: 1.05, capacityCost: 3, cost: { matter: 380, energy: 280, data: 120 }, productionTime: 24,
    attackDamage: 48, attackRange: 4.2, attackCooldown: 1.8, vision: 13, autoAcquires: true,
  },
} as const satisfies Readonly<Record<UnitTypeId, UnitConfig>>;
