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

export const UNITS = {
  worker: {
    id: 'worker', label: 'Worker Agent', maxHp: 70, movementSpeed: 5.2,
    radius: 0.45, capacityCost: 1, cost: { matter: 45 }, productionTime: 6,
    attackDamage: 7, attackRange: 1.6, attackCooldown: 1.1, vision: 9, autoAcquires: false,
  },
  striker: {
    id: 'striker', label: 'Striker', maxHp: 120, movementSpeed: 4,
    radius: 0.52, capacityCost: 1, cost: { matter: 60, energy: 20 }, productionTime: 8,
    attackDamage: 12, attackRange: 2.5, attackCooldown: 0.9, vision: 11, autoAcquires: true,
  },
  ranger: {
    id: 'ranger', label: 'Ranger', maxHp: 72, movementSpeed: 4.5,
    radius: 0.46, capacityCost: 1, cost: { matter: 75, energy: 45, data: 5 }, productionTime: 10,
    attackDamage: 18, attackRange: 8, attackCooldown: 1.45, vision: 14, autoAcquires: true,
  },
  scout: {
    id: 'scout', label: 'Scout Drone', maxHp: 48, movementSpeed: 7.2,
    radius: 0.4, capacityCost: 1, cost: { matter: 45, energy: 60 }, productionTime: 8,
    attackDamage: 4, attackRange: 3.5, attackCooldown: 1.1, vision: 20, autoAcquires: false,
  },
  titan: {
    id: 'titan', label: 'Titan', maxHp: 620, movementSpeed: 2.5,
    radius: 1.05, capacityCost: 3, cost: { matter: 420, energy: 260, data: 80 }, productionTime: 24,
    attackDamage: 48, attackRange: 4.2, attackCooldown: 1.8, vision: 13, autoAcquires: true,
  },
} as const satisfies Readonly<Record<UnitTypeId, UnitConfig>>;
