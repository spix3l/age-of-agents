import { MatchSimulation, type MatchSimulationOptions } from '../match/MatchSimulation';
import { pathMetrics, resetPathMetrics } from '../navigation/AStar';

/** Wall-clock cost of one simulation phase, accumulated over a profiled run. */
export interface PhaseCost {
  readonly phase: string;
  readonly totalMs: number;
  /** Worst single call. This is what a frame hitch looks like, so it matters more than the mean. */
  readonly maxMs: number;
  readonly calls: number;
}

export interface ProfileReport {
  readonly seed: number;
  readonly simulatedSeconds: number;
  readonly steps: number;
  readonly wallMs: number;
  /** Simulated seconds per wall-clock second. Above 1 means the match outruns real time. */
  readonly speedup: number;
  readonly phases: readonly PhaseCost[];
  readonly pathSearches: number;
  readonly pathExpansions: number;
  readonly peakUnits: number;
  readonly peakBuildings: number;
}

interface Tally { total: number; max: number; calls: number }

/**
 * Times each simulation phase across a headless match.
 *
 * The systems are wrapped on the instance rather than inside `MatchSimulation.step`, so the shipped
 * simulation carries no profiling branch and the phase order stays whatever `step` actually does.
 * Anything `step` does outside a wrapped system — spawning, death processing — lands in `other`.
 */
export interface ProfileOptions extends MatchSimulationOptions {
  readonly seconds?: number;
  /** Runs once before the first step, e.g. to order both armies at each other. */
  readonly onStart?: (sim: MatchSimulation) => void;
}

export function profileMatch(options: ProfileOptions = {}): ProfileReport {
  const { seconds = 300, onStart, ...matchOptions } = options;
  const sim = new MatchSimulation(matchOptions);
  onStart?.(sim);
  const totals = new Map<string, Tally>();

  const record = (phase: string, cost: number): void => {
    const entry = totals.get(phase) ?? { total: 0, max: 0, calls: 0 };
    entry.total += cost;
    entry.max = Math.max(entry.max, cost);
    entry.calls += 1;
    totals.set(phase, entry);
  };

  const wrap = <T extends { update: (...args: never[]) => unknown }>(phase: string, system: T | null): void => {
    if (!system) return;
    const original = system.update.bind(system) as (...args: never[]) => unknown;
    system.update = ((...args: never[]) => {
      const start = performance.now();
      const result = original(...args);
      record(phase, performance.now() - start);
      return result;
    }) as T['update'];
  };

  wrap('movement', sim.movement);
  wrap('gathering', sim.gathering);
  wrap('automation', sim.automation);
  wrap('construction', sim.construction);
  wrap('production', sim.production);
  wrap('combat', sim.combat);
  wrap('turrets', sim.turrets);
  wrap('opponentAI', sim.opponent);

  const syncOriginal = sim.targets.sync.bind(sim.targets);
  sim.targets.sync = ((entities: Parameters<typeof syncOriginal>[0]) => {
    const start = performance.now();
    const result = syncOriginal(entities);
    record('spatialHash', performance.now() - start);
    return result;
  }) as typeof sim.targets.sync;

  const delta = 1 / 30;
  const steps = Math.round(seconds / delta);
  let peakUnits = 0;
  let peakBuildings = 0;
  let taken = 0;

  resetPathMetrics();
  const wallStart = performance.now();
  for (; taken < steps && !sim.match.isOver; taken += 1) {
    const stepStart = performance.now();
    sim.step(delta);
    record('step', performance.now() - stepStart);
    peakUnits = Math.max(peakUnits, sim.state.units.alive().length);
    peakBuildings = Math.max(peakBuildings, sim.state.buildings.alive().length);
  }
  const wallMs = performance.now() - wallStart;

  const stepTotal = totals.get('step');
  totals.delete('step');
  const measured = [...totals.values()].reduce((sum, entry) => sum + entry.total, 0);
  if (stepTotal) {
    record('other', Math.max(0, stepTotal.total - measured));
    const other = totals.get('other');
    if (other) other.calls = stepTotal.calls;
  }

  const phases = [...totals.entries()]
    .map(([phase, entry]) => ({ phase, totalMs: entry.total, maxMs: entry.max, calls: entry.calls }))
    .sort((a, b) => b.totalMs - a.totalMs);

  return {
    seed: matchOptions.seed ?? 0,
    simulatedSeconds: taken * delta,
    steps: taken,
    wallMs,
    speedup: (taken * delta) / (wallMs / 1000),
    phases,
    pathSearches: pathMetrics.searches,
    pathExpansions: pathMetrics.expansions,
    peakUnits,
    peakBuildings,
  };
}

/** Formats a report as the table `PERFORMANCE.md` records. */
export function formatProfile(report: ProfileReport): string {
  const total = report.phases.reduce((sum, phase) => sum + phase.totalMs, 0) || 1;
  return [
    `seed ${report.seed} — ${report.simulatedSeconds.toFixed(0)}s simulated in ${(report.wallMs / 1000).toFixed(2)}s wall (${report.speedup.toFixed(0)}x real time)`,
    `peak ${report.peakUnits} units / ${report.peakBuildings} buildings — ${report.pathSearches} path searches, ${report.pathExpansions.toLocaleString('en-US')} cell expansions`,
    '',
    '| Phase | Total ms | Share | Worst step ms |',
    '|---|---:|---:|---:|',
    ...report.phases.map((phase) =>
      `| ${phase.phase} | ${phase.totalMs.toFixed(0)} | ${((phase.totalMs / total) * 100).toFixed(1)}% | ${phase.maxMs.toFixed(1)} |`),
  ].join('\n');
}
