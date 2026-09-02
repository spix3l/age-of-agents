import { createEconomyScenario, type EconomyScenario } from '../scenarios/economy';

export interface MatchOptions { readonly seed?: number }

export function createMatch(options: MatchOptions = {}): EconomyScenario {
  return createEconomyScenario(options.seed);
}
