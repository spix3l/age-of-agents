import { MatchSimulation } from '../match/MatchSimulation';
import type { AIDifficulty } from '../../data/ai';
import type { MatchResult } from '../match/MatchState';
import type { AIState } from '../ai/AIStrategy';
import { Logger, type LogEntry } from './Logger';

export interface SoakOptions {
  readonly seed: number;
  readonly difficulty?: AIDifficulty;
  readonly minutes?: number;
  readonly sampleSeconds?: number;
  readonly logger?: Logger;
}

export interface SoakSample {
  readonly at: number;
  readonly state: AIState;
  readonly workers: number;
  readonly army: number;
  readonly matter: number;
  readonly energy: number;
  readonly buildings: number;
}

export interface SoakReport {
  readonly seed: number;
  readonly result: MatchResult | null;
  readonly durationSeconds: number;
  readonly transitions: readonly { readonly at: number; readonly state: AIState }[];
  readonly samples: readonly SoakSample[];
  readonly invariantFailures: readonly string[];
  readonly logs: readonly LogEntry[];
}

/**
 * Unattended fixed-seed match against an idle player. Reports strategic transitions and any
 * invariant breach so AI failures are diagnosable without watching a live game.
 */
export function runSoak(options: SoakOptions): SoakReport {
  const minutes = options.minutes ?? 20;
  const sampleSeconds = options.sampleSeconds ?? 30;
  const logger = options.logger ?? new Logger({ categories: ['ai'] });
  const simulation = new MatchSimulation({
    seed: options.seed,
    scenario: 'economy',
    opponent: { seed: options.seed, difficulty: options.difficulty },
  });
  const ai = simulation.opponent;
  if (!ai) throw new Error('Soak runs require an opponent');

  const transitions: { at: number; state: AIState }[] = [];
  const samples: SoakSample[] = [];
  const invariantFailures: string[] = [];
  let previousState: AIState | null = null;

  const totalSteps = Math.round(minutes * 60 * 30);
  for (let step = 0; step < totalSteps && !simulation.match.isOver; step += 1) {
    simulation.step(1 / 30);
    if (ai.state !== previousState) {
      previousState = ai.state;
      transitions.push({ at: round(simulation.elapsedSeconds), state: ai.state });
      logger.log('ai', simulation.elapsedSeconds, `${ai.state} — ${ai.debug.reason}`);
    }
    if (step % (sampleSeconds * 30) !== 0) continue;
    samples.push(sample(simulation, ai.state));
    invariantFailures.push(...checkInvariants(simulation));
  }
  invariantFailures.push(...checkInvariants(simulation));

  return {
    seed: options.seed,
    result: simulation.match.result,
    durationSeconds: round(simulation.elapsedSeconds),
    transitions,
    samples,
    invariantFailures: [...new Set(invariantFailures)],
    logs: logger.history,
  };
}

function sample(simulation: MatchSimulation, state: AIState): SoakSample {
  const debug = simulation.opponent!.debug;
  return {
    at: round(simulation.elapsedSeconds),
    state,
    workers: debug.workers,
    army: debug.army,
    matter: debug.matter,
    energy: debug.energy,
    buildings: simulation.buildingsOf('enemy').length,
  };
}

/** Cross-system invariants that no AI decision may ever break. */
export function checkInvariants(simulation: MatchSimulation): string[] {
  const failures: string[] = [];
  const at = round(simulation.elapsedSeconds);
  for (const team of ['player', 'enemy'] as const) {
    const economy = simulation.economy(team);
    if (!economy) continue;
    const balances = economy.ledger.snapshot();
    if (balances.matter < 0 || balances.energy < 0) failures.push(`${at}s ${team} negative balance`);
    const capacity = economy.capacity.snapshot();
    if (capacity.used < 0 || capacity.reserved < 0) failures.push(`${at}s ${team} negative capacity`);
    const liveUnits = simulation.unitsOf(team).length;
    if (capacity.used < liveUnits) failures.push(`${at}s ${team} capacity ${capacity.used} below ${liveUnits} live agents`);
  }
  for (const unit of simulation.state.units.all()) {
    if (!unit.alive) failures.push(`${at}s dead unit ${unit.id} still registered`);
    const target = unit.combat.targetId;
    if (target && !simulation.state.units.has(target) && !simulation.state.buildings.has(target)) {
      failures.push(`${at}s ${unit.id} targets missing entity`);
    }
  }
  for (const building of simulation.state.buildings.all()) {
    if (!building.alive) failures.push(`${at}s dead building ${building.id} still registered`);
  }
  return failures;
}

function round(value: number): number { return Math.round(value * 10) / 10; }
