import { describe, it } from 'vitest';
import { runSoak } from './soak';

const SEEDS = [10, 20, 30, 40, 50] as const;
const DIFFICULTIES = ['relaxed', 'standard', 'relentless'] as const;

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}m ${String(Math.round(seconds % 60)).padStart(2, '0')}s`;
}

/**
 * Not an assertion suite — the run table D7-05 records in `QA.md`. `opponentGate.test.ts` is what
 * actually fails on a pacing regression; this regenerates the evidence behind those thresholds:
 *
 * `npx vitest run src/game/debug/pacing.bench.test.ts --reporter=verbose`
 */
describe.skip('match pacing', () => {
  it('measures every shipped seed at every difficulty', () => {
    const rows = [
      '| Seed | Difficulty | Result | Duration | First contact | Peak army | Invariant failures |',
      '|---|---|---|---:|---:|---:|---:|',
    ];
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const report = runSoak({ seed, difficulty, minutes: 40, sampleSeconds: 30 });
        const attack = report.transitions.find((transition) => transition.state === 'ATTACK');
        const peakArmy = Math.max(0, ...report.samples.map((sample) => sample.army));
        rows.push(`| ${seed} | ${difficulty} | ${report.result ?? 'unresolved'} | ${clock(report.durationSeconds)}`
          + ` | ${attack ? clock(attack.at) : '—'} | ${peakArmy} | ${report.invariantFailures.length} |`);
      }
    }
    console.log(rows.join('\n'));
  }, 3_000_000);
});
