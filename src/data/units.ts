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
}

export const UNITS = {
  worker: {
    id: 'worker', label: 'Worker Agent', maxHp: 70, movementSpeed: 5.2,
    radius: 0.45, capacityCost: 1, cost: { matter: 45 }, productionTime: 6,
  },
  striker: {
    id: 'striker', label: 'Striker', maxHp: 120, movementSpeed: 4,
    radius: 0.52, capacityCost: 1, cost: { matter: 60, energy: 20 }, productionTime: 8,
  },
} as const satisfies Readonly<Record<UnitTypeId, UnitConfig>>;
