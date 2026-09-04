import type { BuildingTypeId } from '../game/types/ids';
import type { HarvestableResourceType, ResourceCost } from '../game/types/simulation';

/**
 * One synthesis plant's conversion.
 *
 * A cycle is atomic: the whole input is charged and the whole output is deposited, or nothing
 * happens at all. Discrete cycles keep the readouts honest -- income ticks in visible steps the
 * way a Worker's deposit does -- and keep the ledger free of per-frame floating-point dust.
 */
export interface SynthesisRecipe {
  readonly cycleSeconds: number;
  readonly input: ResourceCost;
  readonly output: HarvestableResourceType;
  readonly amount: number;
}

/**
 * Manufactured resources: what a colony does once the ground around it is stripped.
 *
 * Every recipe is deliberately a loss. Priced by how much of each resource a seeded map actually
 * holds -- roughly 5400 Matter to 2000 Energy to 550 Data per faction -- a Reclamation Plant
 * returns about three quarters of the value it burns and a Cognition Lab about five sixths, and
 * both occupy Agent Capacity while they run. Synthesis is the floor under a dead economy, never
 * a reason to stop mining a live deposit.
 */
export const SYNTHESIS: Partial<Readonly<Record<BuildingTypeId, SynthesisRecipe>>> = {
  // Energy into Matter. Matter is what a colony burns fastest, and it is the first thing a
  // besieged base runs out of when its outer deposits are behind enemy lines.
  reclaimer: { cycleSeconds: 2, input: { energy: 4 }, output: 'matter', amount: 8 },
  // Matter and Energy into Data. Data is the scarcest thing on the map and the only route to
  // Generation III, so a colony that mined its Archives dry can still evolve -- slowly.
  datalab: { cycleSeconds: 3, input: { matter: 12, energy: 9 }, output: 'data', amount: 3 },
};

export function synthesisFor(kind: BuildingTypeId): SynthesisRecipe | undefined {
  return SYNTHESIS[kind];
}
