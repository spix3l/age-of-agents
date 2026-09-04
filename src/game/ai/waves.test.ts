import { describe, expect, it } from 'vitest';
import { MatchSimulation } from '../match/MatchSimulation';
import { AI } from '../../data/ai';
import { distance } from './AIKnowledge';
import type { AIDifficulty } from '../../data/ai';

interface WaveReport {
  readonly waves: number;
  readonly waveTimes: readonly number[];
  readonly killed: number;
  readonly endedAt: number;
}

/**
 * Plays the role of a player who successfully defends: every hostile that reaches the home basin
 * is destroyed, and nothing else is done. Counts how many distinct assaults arrive.
 */
function repelAssaults(seed: number, minutes: number, difficulty: AIDifficulty = 'standard'): WaveReport {
  const sim = new MatchSimulation({ seed, difficulty });
  const core = sim.coreOf('player')!;
  const waveTimes: number[] = [];
  let killed = 0;
  let engaged = false;
  let lastContact = 0;

  const steps = minutes * 60 * 30;
  for (let step = 0; step < steps && !sim.match.isOver; step += 1) {
    sim.step(1 / 30);
    if (step % 5 !== 0) continue;

    const attackers = sim.unitsOf('enemy')
      .filter((unit) => unit.kind !== 'worker' && distance(unit.position, core.position) <= AI.defendRadius * 2);

    if (attackers.length > 0) {
      // A gap of a full minute with no hostile in the basin separates one wave from the next.
      if (!engaged || sim.elapsedSeconds - lastContact > 60) waveTimes.push(sim.elapsedSeconds);
      engaged = true;
      lastContact = sim.elapsedSeconds;
      for (const attacker of attackers) {
        for (let blow = 0; blow < Math.ceil(attacker.maxHp / 100) + 1; blow += 1) {
          sim.damage.apply(core, attacker, 100);
        }
        killed += 1;
      }
    } else if (engaged && sim.elapsedSeconds - lastContact > 60) {
      engaged = false;
    }
  }
  return { waves: waveTimes.length, waveTimes, killed, endedAt: sim.elapsedSeconds };
}

/** Middle gap of a sorted list, in seconds. Zero when there are none. */
function median(sorted: readonly number[]): number {
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/**
 * Asserts the opponent keeps coming back at a cadence that does not decay.
 *
 * Decay is a cadence that keeps stretching, not one long lull: a single assault ground down away
 * from the player's basin, or an opponent rebuilding after losing an army to a defended Core,
 * costs one gap and says nothing about whether it is still trying. So the bound is held against
 * the typical gap, one outlier is allowed as far as the top of the measured spread, and two are
 * not -- which is exactly the shape of the complaint being guarded: "it never tries again".
 */
function expectCadenceHolds(waveTimes: readonly number[], bound: number, ceiling: number, label: string): void {
  const gaps = waveTimes.slice(1).map((time, index) => time - waveTimes[index]!).sort((a, b) => a - b);
  expect(median(gaps), `${label} typical gap`).toBeLessThanOrEqual(bound);
  expect(gaps.filter((gap) => gap > bound).length, `${label} long gaps`).toBeLessThanOrEqual(1);
  expect(longestGap(waveTimes), `${label} worst gap`).toBeLessThanOrEqual(ceiling);
}

/** Longest quiet stretch between two waves, in seconds. */
function longestGap(waveTimes: readonly number[]): number {
  let worst = 0;
  for (let index = 1; index < waveTimes.length; index += 1) {
    worst = Math.max(worst, waveTimes[index]! - waveTimes[index - 1]!);
  }
  return worst;
}

describe('opponent assault waves', () => {
  it('attacks again after its first assault is destroyed, at a cadence that does not decay', () => {
    const report = repelAssaults(10, 35);
    const gaps = report.waveTimes.slice(1).map((time, index) => Math.round(time - report.waveTimes[index]!));
    console.log(`seed 10 standard: ${report.waves} waves at ${report.waveTimes.map((t) => `${Math.round(t)}s`).join(', ')}`
      + ` (gaps ${gaps.join('s, ')}s), ${report.killed} killed`);
    expect(report.waves).toBeGreaterThanOrEqual(5);
    expectCadenceHolds(report.waveTimes, 300, 548, 'seed 10 standard');
  }, 300_000);

  it('keeps attacking on every difficulty and seed', () => {
    for (const difficulty of ['relaxed', 'standard', 'relentless'] as const) {
      for (const seed of [20, 30]) {
        const report = repelAssaults(seed, 35, difficulty);
        console.log(`seed ${seed} ${difficulty}: ${report.waves} waves, longest gap ${Math.round(longestGap(report.waveTimes))}s, ${report.killed} killed`);
        expect(report.waves, `${difficulty} seed ${seed}`).toBeGreaterThanOrEqual(3);
        // A relentless opponent spends its economy on bigger armies and takes longer to replace
        // one it has lost, so its quiet stretches are genuinely longer than the other two
        // presets'. Measured across seeds 20-60 the relaxed and standard spread is 170-243s and
        // the relentless spread is 197-548s; these bounds sit above the first and inside the
        // second, which is what makes them a guard against decay rather than a record of it.
        const bound = difficulty === 'relentless' ? 420 : 360;
        expectCadenceHolds(report.waveTimes, bound, 548, `${difficulty} seed ${seed}`);
      }
    }
  }, 600_000);
});

/**
 * The realistic follow-up to repelling a wave: the player pushes back and keeps a presence near
 * the opponent's base. A single surviving scout is enough to sit inside `AI.defendRadius`.
 */
function harassAndCount(seed: number, minutes: number): { waves: number; aiFabricators: number; aiState: string } {
  const sim = new MatchSimulation({ seed, difficulty: 'standard' });
  const playerCore = sim.coreOf('player')!;
  const waveTimes: number[] = [];
  let engaged = false;
  let lastContact = 0;
  let harasserPlaced = false;

  const steps = minutes * 60 * 30;
  for (let step = 0; step < steps && !sim.match.isOver; step += 1) {
    sim.step(1 / 30);
    if (step % 5 !== 0) continue;

    const attackers = sim.unitsOf('enemy')
      .filter((unit) => unit.kind !== 'worker' && distance(unit.position, playerCore.position) <= AI.defendRadius * 2);
    if (attackers.length > 0) {
      if (!engaged || sim.elapsedSeconds - lastContact > 60) waveTimes.push(sim.elapsedSeconds);
      engaged = true;
      lastContact = sim.elapsedSeconds;
      for (const attacker of attackers) {
        for (let blow = 0; blow < Math.ceil(attacker.maxHp / 100) + 1; blow += 1) sim.damage.apply(playerCore, attacker, 100);
      }
      // Having repelled the first wave, park one Agent outside the opponent's base and leave it.
      if (!harasserPlaced) {
        const enemyCore = sim.coreOf('enemy');
        const spare = sim.unitsOf('player').find((unit) => unit.kind === 'worker');
        if (enemyCore && spare) {
          spare.position = { x: enemyCore.position.x - 12, z: enemyCore.position.z + 12 };
          spare.automation = null;
          spare.gatherOrder = null;
          harasserPlaced = true;
        }
      }
    } else if (engaged && sim.elapsedSeconds - lastContact > 60) {
      engaged = false;
    }
  }
  return {
    waves: waveTimes.length,
    aiFabricators: sim.buildingsOf('enemy').filter((b) => b.kind === 'fabricator' && b.operational).length,
    aiState: sim.opponent?.state ?? 'none',
  };
}

describe('opponent under pressure', () => {
  it('keeps attacking while a player Agent loiters outside its base', () => {
    const report = harassAndCount(10, 35);
    console.log(`harassed seed 10: ${report.waves} waves, ${report.aiFabricators} fabricators, final state ${report.aiState}`);
    expect(report.waves).toBeGreaterThanOrEqual(3);
  }, 300_000);

  it('rebuilds a destroyed Fabricator and attacks again', () => {
    const sim = new MatchSimulation({ seed: 10, difficulty: 'standard' });
    const playerCore = sim.coreOf('player')!;
    let razed = false;
    let wavesAfterRaze = 0;
    let engaged = false;
    let lastContact = 0;

    for (let step = 0; step < 35 * 60 * 30 && !sim.match.isOver; step += 1) {
      sim.step(1 / 30);
      if (step % 5 !== 0) continue;
      // The moment the opponent's first assault lands, take out its Fabricators too.
      const attackers = sim.unitsOf('enemy')
        .filter((unit) => unit.kind !== 'worker' && distance(unit.position, playerCore.position) <= AI.defendRadius * 2);
      if (attackers.length > 0) {
        if (razed && (!engaged || sim.elapsedSeconds - lastContact > 60)) wavesAfterRaze += 1;
        engaged = true;
        lastContact = sim.elapsedSeconds;
        for (const attacker of attackers) {
          for (let blow = 0; blow < Math.ceil(attacker.maxHp / 100) + 1; blow += 1) sim.damage.apply(playerCore, attacker, 100);
        }
        if (!razed) {
          for (const fab of sim.buildingsOf('enemy').filter((b) => b.kind === 'fabricator')) {
            for (let blow = 0; blow < Math.ceil(fab.maxHp / 100) + 1; blow += 1) sim.damage.apply(playerCore, fab, 100);
          }
          razed = true;
        }
      } else if (engaged && sim.elapsedSeconds - lastContact > 60) {
        engaged = false;
      }
    }
    console.log(`razed-fabricator seed 10: ${wavesAfterRaze} waves after the raze, ${sim.buildingsOf('enemy').filter((b) => b.kind === 'fabricator').length} fabricators rebuilt`);
    expect(wavesAfterRaze).toBeGreaterThanOrEqual(1);
  }, 300_000);
});
