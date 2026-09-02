import { createBattleScenario } from '../scenarios/battle';
import { createEconomyScenario, type EconomyScenario } from '../scenarios/economy';

export type ScenarioId = 'economy' | 'battle';
export interface MatchOptions { readonly seed?: number; readonly scenario?: ScenarioId }

/** `?scenario=battle` opens the Day 4 debug armies instead of the shipping opening. */
export function readScenarioFromLocation(search = globalThis.location?.search ?? ''): ScenarioId {
  return new URLSearchParams(search).get('scenario') === 'battle' ? 'battle' : 'economy';
}

export function createMatch(options: MatchOptions = {}): EconomyScenario {
  const scenario = options.scenario ?? readScenarioFromLocation();
  return scenario === 'battle' ? createBattleScenario(options.seed) : createEconomyScenario(options.seed);
}
