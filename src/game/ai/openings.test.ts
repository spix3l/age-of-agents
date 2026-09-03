import { describe, expect, it } from 'vitest';
import { MatchSimulation } from '../match/MatchSimulation';
import { OPENING_PLANS } from './OpeningPlan';

interface Fingerprint {
  readonly plan: string;
  readonly firstScoutKind: string;
  readonly firstBuilding: string;
  readonly buildings: number;
  readonly kinds: number;
  readonly turrets: number;
  /** Turrets plus walls: what the colony has that is purely defensive. */
  readonly defences: number;
}

/** Watches one match's opening and records what made it distinctive. */
function fingerprint(seed: number, minutes = 12): Fingerprint {
  const sim = new MatchSimulation({ seed, difficulty: 'standard' });
  let firstScoutKind = 'none';
  let firstBuilding = 'none';
  for (let step = 0; step < minutes * 60 * 30 && !sim.match.isOver; step += 1) {
    sim.step(1 / 30);
    if (step % 15 !== 0) continue;
    if (firstScoutKind === 'none') {
      // The Agent the opponent actually nominated, not merely the first one to wander far --
      // a Worker walking to a distant deposit is not a scout.
      const scoutId = sim.opponent?.debug.scoutId;
      const scout = scoutId ? sim.unitsOf('enemy').find((unit) => unit.id === scoutId) : undefined;
      if (scout) firstScoutKind = scout.kind;
    }
    if (firstBuilding === 'none') {
      const built = sim.buildingsOf('enemy').find((building) => building.kind !== 'core');
      if (built) firstBuilding = built.kind;
    }
  }
  const buildings = sim.buildingsOf('enemy');
  return {
    plan: sim.opponent?.plan.id ?? 'none',
    firstScoutKind,
    firstBuilding,
    buildings: buildings.length,
    kinds: new Set(buildings.map((building) => building.kind)).size,
    turrets: buildings.filter((building) => building.kind === 'turret').length,
    defences: buildings.filter((building) => building.kind === 'turret' || building.kind === 'wall').length,
  };
}

describe('opponent openings', () => {
  it('picks a plan from the seed and repeats it exactly', () => {
    const first = fingerprint(10, 4);
    const repeat = fingerprint(10, 4);
    expect(repeat).toEqual(first);
  }, 120_000);

  it('plays materially different openings across seeds', () => {
    const seeds = [10, 20, 30, 40, 50, 60, 70, 80];
    const prints = seeds.map((seed) => fingerprint(seed, 10));
    for (const [index, print] of prints.entries()) {
      console.log(`seed ${seeds[index]}: plan=${print.plan} scout=${print.firstScoutKind} first=${print.firstBuilding}`
        + ` buildings=${print.buildings} kinds=${print.kinds} defences=${print.defences}`);
    }
    // The complaint was that every match ran the same script. Several distinct plans must show
    // up across a handful of seeds, and they must not all open on the same structure.
    expect(new Set(prints.map((print) => print.plan)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(prints.map((print) => print.firstBuilding)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(prints.map((print) => print.firstScoutKind)).size).toBeGreaterThanOrEqual(2);
  }, 600_000);

  it('builds a real colony with defences rather than a Core and two sheds', () => {
    for (const seed of [10, 30, 50]) {
      const print = fingerprint(seed, 16);
      console.log(`seed ${seed}: ${print.buildings} buildings, ${print.kinds} kinds, ${print.defences} defences (${print.turrets} turrets)`);
      expect(print.buildings, `seed ${seed} buildings`).toBeGreaterThanOrEqual(6);
      expect(print.kinds, `seed ${seed} kinds`).toBeGreaterThanOrEqual(3);
      expect(print.defences, `seed ${seed} defences`).toBeGreaterThanOrEqual(1);
    }
  }, 600_000);

  it('keeps every plan viable: none stalls before it can fight', () => {
    expect(OPENING_PLANS.length).toBeGreaterThanOrEqual(4);
    for (const plan of OPENING_PLANS) {
      expect(plan.workerScale).toBeGreaterThan(0.5);
      expect(plan.scoutWith.length).toBeGreaterThan(0);
      expect(plan.unitBias).toContain('striker');
    }
  });
});
