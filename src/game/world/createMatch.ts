import { createBattleScenario } from '../scenarios/battle';
import { createEconomyScenario, type EconomyScenario } from '../scenarios/economy';
import { createShowcaseScenario } from '../scenarios/showcase';

export type ScenarioId = 'economy' | 'battle' | 'showcase';
export interface MatchOptions {
  readonly seed?: number;
  readonly scenario?: ScenarioId;
  /** Strikers per side in the battle scenario. Used by the performance benchmark. */
  readonly armySize?: number;
  /** Lays the opening without an opposing colony. Freestyle mode's world. */
  readonly solo?: boolean;
}

/**
 * `?scenario=battle` opens the Day 4 debug armies and `?scenario=showcase` the art-review
 * colony instead of the shipping opening. `?army=50` scales the battle scenario to the
 * 100-unit benchmark `PERFORMANCE.md` records.
 */
export function readScenarioFromLocation(search = globalThis.location?.search ?? ''): ScenarioId {
  const scenario = new URLSearchParams(search).get('scenario');
  return scenario === 'battle' || scenario === 'showcase' ? scenario : 'economy';
}

/** Strikers per side for the battle scenario, clamped to something a browser can still draw. */
export function readArmySizeFromLocation(search = globalThis.location?.search ?? ''): number | undefined {
  const raw = new URLSearchParams(search).get('army');
  if (raw === null) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, parsed)) : undefined;
}

export function createMatch(options: MatchOptions = {}): EconomyScenario {
  const scenario = options.scenario ?? readScenarioFromLocation();
  const armySize = options.armySize ?? readArmySizeFromLocation();
  return scenario === 'battle' ? createBattleScenario(options.seed, armySize)
    : scenario === 'showcase' ? createShowcaseScenario(options.seed)
      : createEconomyScenario(options.seed, options.solo);
}
