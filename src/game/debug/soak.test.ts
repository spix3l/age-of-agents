import { describe, expect, it } from 'vitest';
import { MatchSimulation } from '../match/MatchSimulation';
import { Logger, type LogEntry } from './Logger';
import { checkInvariants, runSoak } from './soak';

describe('AI observability', () => {
  it('filters log categories and keeps a bounded buffer without a console sink', () => {
    const sunk: LogEntry[] = [];
    const logger = new Logger({ categories: ['ai'], capacity: 3, sink: (entry) => sunk.push(entry) });
    logger.log('combat', 1, 'ignored');
    for (let index = 0; index < 5; index += 1) logger.log('ai', index, `entry-${index}`);
    expect(logger.history).toHaveLength(3);
    expect(logger.history.map((entry) => entry.message)).toEqual(['entry-2', 'entry-3', 'entry-4']);
    expect(sunk).toHaveLength(5);

    logger.setSink(null);
    logger.setCategories([]);
    logger.log('ai', 9, 'disabled');
    expect(logger.history.at(-1)?.message).toBe('entry-4');
  });

  it('runs three deterministic seeds with no invariant failures and readable transitions', () => {
    for (const seed of [101, 202, 303]) {
      const report = runSoak({ seed, minutes: 6, sampleSeconds: 60 });
      expect(report.invariantFailures).toEqual([]);
      expect(report.transitions.length).toBeGreaterThan(0);
      expect(report.transitions.every((entry) => entry.at >= 0)).toBe(true);
      expect(report.samples.some((entry) => entry.workers > 3)).toBe(true);
      expect(report.logs.length).toBe(report.transitions.length);

      const repeat = runSoak({ seed, minutes: 6, sampleSeconds: 60 });
      expect(repeat.samples).toEqual(report.samples);
      expect(repeat.transitions).toEqual(report.transitions);
      expect(repeat.durationSeconds).toBe(report.durationSeconds);
    }
    // 36 simulated minutes twice; standalone this is ~15s but the full suite runs these AI
    // sims alongside the other CPU-heavy soak tests and contention pushed 60s over the line.
  }, 90_000);

  it('reports invariant breaches rather than silently continuing', () => {
    const simulation = new MatchSimulation({ seed: 404, scenario: 'economy', opponent: false });
    expect(checkInvariants(simulation)).toEqual([]);

    const ghost = simulation.unitsOf('player')[0]!;
    ghost.alive = false;
    expect(checkInvariants(simulation).some((failure) => failure.includes('still registered'))).toBe(true);
  });
});
