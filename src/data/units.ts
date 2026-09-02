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
} as const satisfies Readonly<Record<UnitTypeId, UnitConfig>>;
