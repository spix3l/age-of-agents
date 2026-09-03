import { BUILDING_GENERATION, GENERATIONS, UNIT_GENERATION, nextGeneration } from '../../data/technologies';
import type { EconomyLedger } from '../economy/EconomyLedger';
import type { BuildingTypeId, UnitTypeId } from '../types/ids';
import type { Generation, Team } from '../types/simulation';

export type AdvanceRejection = 'MAX_GENERATION' | 'INSUFFICIENT_RESOURCES';
export type AdvanceResult = { readonly ok: true; readonly generation: Generation } | { readonly ok: false; readonly reason: AdvanceRejection };

export class TechnologySystem {
  constructor(private readonly generations: Map<Exclude<Team, 'neutral'>, Generation>) {}

  current(team: Exclude<Team, 'neutral'>): Generation { return this.generations.get(team) ?? 1; }

  canBuild(team: Exclude<Team, 'neutral'>, type: BuildingTypeId): boolean {
    return this.current(team) >= BUILDING_GENERATION[type];
  }

  canProduce(team: Exclude<Team, 'neutral'>, type: UnitTypeId): boolean {
    return this.current(team) >= UNIT_GENERATION[type];
  }

  advance(team: Exclude<Team, 'neutral'>, ledger: EconomyLedger): AdvanceResult {
    const current = this.current(team);
    const target = nextGeneration(current);
    const cost = GENERATIONS[current].advanceCost;
    if (!target || !cost) return { ok: false, reason: 'MAX_GENERATION' };
    if (!ledger.spend(cost)) return { ok: false, reason: 'INSUFFICIENT_RESOURCES' };
    this.generations.set(team, target);
    return { ok: true, generation: target };
  }
}
