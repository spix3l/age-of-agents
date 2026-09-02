import type { HarvestableResourceType } from '../game/types/simulation';

export interface ResourceConfig {
  readonly type: HarvestableResourceType;
  readonly label: string;
  readonly capacity: number;
  readonly harvestAmount: number;
  readonly harvestSeconds: number;
}

export const RESOURCES = {
  matter: { type: 'matter', label: 'Matter Deposit', capacity: 720, harvestAmount: 10, harvestSeconds: 1.2 },
  energy: { type: 'energy', label: 'Energy Vent', capacity: 560, harvestAmount: 8, harvestSeconds: 1.45 },
} as const satisfies Readonly<Record<HarvestableResourceType, ResourceConfig>>;

export const STARTING_ECONOMY = Object.freeze({ matter: 25, energy: 20, data: 0, capacity: 8 });
