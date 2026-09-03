import { createBattleScenario } from '../scenarios/battle';
import { createEconomyScenario, type EconomyScenario } from '../scenarios/economy';
import { createShowcaseScenario } from '../scenarios/showcase';

export type ScenarioId = 'economy' | 'battle' | 'showcase';
export interface MatchOptions { readonly seed?: number; readonly scenario?: ScenarioId }

/**
 * `?scenario=battle` opens the Day 4 debug armies and `?scenario=showcase` the art-review
 * colony instead of the shipping opening.
 */
export function readScenarioFromLocation(search = globalThis.location?.search ?? ''): ScenarioId {
  const scenario = new URLSearchParams(search).get('scenario');
  return scenario === 'battle' || scenario === 'showcase' ? scenario : 'economy';
}

export function createMatch(options: MatchOptions = {}): EconomyScenario {
  const scenario = options.scenario ?? readScenarioFromLocation();
  return scenario === 'battle' ? createBattleScenario(options.seed)
    : scenario === 'showcase' ? createShowcaseScenario(options.seed)
      : createEconomyScenario(options.seed);
}
