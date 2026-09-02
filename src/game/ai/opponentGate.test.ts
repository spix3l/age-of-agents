import { describe, expect, it } from 'vitest';
import { runSoak, type SoakReport } from '../debug/soak';

const SEEDS = [10, 20, 30, 40, 50] as const;
const MINUTES = 22;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : sorted[middle] ?? 0;
}

describe('Day 5 opponent gate', () => {
  const reports: SoakReport[] = SEEDS.map((seed) => runSoak({ seed, minutes: MINUTES, sampleSeconds: 60 }));

  it('destroys an idle player Core in at least four of five fixed-seed runs', () => {
    const wins = reports.filter((report) => report.result === 'defeat');
    expect(wins.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps the median idle-player loss inside the 8–20 minute target', () => {
    const durations = reports.filter((report) => report.result === 'defeat').map((report) => report.durationSeconds);
    const middle = median(durations);
    expect(middle).toBeGreaterThanOrEqual(8 * 60);
    expect(middle).toBeLessThanOrEqual(20 * 60);
  });

  it('never deadlocks on resources, capacity, placement, production, or pathing', () => {
    for (const report of reports) {
      expect(report.invariantFailures).toEqual([]);
      // A run that ends is by definition not deadlocked; an unfinished run must still be acting.
      if (report.result === null) expect(report.samples.at(-1)?.army).toBeGreaterThan(0);
      const last = report.samples.at(-1);
      expect(last?.workers ?? 0).toBeGreaterThan(3);
      expect(last?.buildings ?? 0).toBeGreaterThan(1);
    }
  });

  it('progresses through economy, army, and assault states in every run', () => {
    for (const report of reports) {
      const states = new Set(report.transitions.map((entry) => entry.state));
      expect(states.has('EXPAND_ECONOMY')).toBe(true);
      expect(states.has('SCOUT')).toBe(true);
      expect(states.has('ATTACK')).toBe(true);
    }
  });

  it('is reproducible for a fixed seed', () => {
    const first = reports[0]!;
    const repeat = runSoak({ seed: SEEDS[0], minutes: MINUTES, sampleSeconds: 60 });
    expect(repeat.result).toBe(first.result);
    expect(repeat.durationSeconds).toBe(first.durationSeconds);
    expect(repeat.transitions).toEqual(first.transitions);
  });
}, 300_000);
