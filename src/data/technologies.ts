import type { BuildingTypeId, UnitTypeId } from '../game/types/ids';
import type { Generation, ResourceCost } from '../game/types/simulation';

export interface GenerationConfig {
  readonly id: Generation;
  readonly label: string;
  readonly subtitle: string;
  readonly advanceCost: ResourceCost | null;
}

export const GENERATIONS: Readonly<Record<Generation, GenerationConfig>> = {
  1: { id: 1, label: 'Awakening', subtitle: 'A curious little machine colony', advanceCost: { matter: 180, energy: 100, data: 40 } },
  2: { id: 2, label: 'Autonomy', subtitle: 'Independent systems and long-range defense', advanceCost: { matter: 320, energy: 220, data: 100 } },
  3: { id: 3, label: 'Singularity', subtitle: 'Heavy cognition and delightful overkill', advanceCost: null },
};

export const UNIT_GENERATION: Readonly<Record<UnitTypeId, Generation>> = {
  worker: 1, striker: 1, ranger: 2, scout: 2, titan: 3,
};

export const BUILDING_GENERATION: Readonly<Record<BuildingTypeId, Generation>> = {
  core: 1, relay: 1, fabricator: 1, habitat: 1, depot: 1, wall: 1, gate: 1, outpost: 1, turret: 1, reclaimer: 2, datalab: 2, foundry: 3,
};

export function nextGeneration(current: Generation): Generation | null {
  return current === 1 ? 2 : current === 2 ? 3 : null;
}
