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
}

export const BUILDINGS = {
  core: { id: 'core', label: 'Core', maxHp: 1500, footprint: [4, 4], cost: {}, constructionTime: 0, capacityContribution: 8 },
  relay: { id: 'relay', label: 'Relay Node', maxHp: 450, footprint: [2, 2], cost: { matter: 80, energy: 20 }, constructionTime: 8, capacityContribution: 5 },
  fabricator: { id: 'fabricator', label: 'Fabricator', maxHp: 800, footprint: [4, 3], cost: { matter: 160, energy: 80 }, constructionTime: 12, capacityContribution: 0 },
} as const satisfies Readonly<Record<BuildingTypeId, BuildingConfig>>;
