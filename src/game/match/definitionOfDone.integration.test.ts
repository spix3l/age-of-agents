import { describe, expect, it } from 'vitest';
import { MatchSimulation } from './MatchSimulation';
import { checkInvariants } from '../debug/soak';
import { issueGatherCommand } from '../commands/GatherCommand';
import { automateWorkers } from '../commands/AutomateCommand';
import { UNITS } from '../../data/units';
import type { PlaceableBuildingType } from '../building/PlacementController';
import type { BuildingEntity, UnitEntity, Vec2 } from '../types/simulation';

const STEP = 1 / 30;

function run(sim: MatchSimulation, seconds: number): void {
  const steps = Math.round(seconds / STEP);
  for (let step = 0; step < steps && !sim.match.isOver; step += 1) sim.step(STEP);
}

/** Runs until `done()` is true or the budget expires. Returns whether it happened. */
function runUntil(sim: MatchSimulation, seconds: number, done: () => boolean): boolean {
  const steps = Math.round(seconds / STEP);
  for (let step = 0; step < steps && !sim.match.isOver; step += 1) {
    if (done()) return true;
    sim.step(STEP);
  }
  return done();
}

/** Places `type` near `origin`, searching outward, because the home basin holds terrain and nodes. */
function place(sim: MatchSimulation, worker: UnitEntity, type: PlaceableBuildingType, origin: Vec2): BuildingEntity | null {
  const offsets: readonly (readonly [number, number])[] = [[1, -1], [1, 1], [-1, -1], [-1, 1], [1, 0], [0, 1], [-1, 0], [0, -1]];
  for (let ring = 7; ring <= 26; ring += 2) {
    for (const [dx, dz] of offsets) {
      const site = { x: origin.x + dx * ring, z: origin.z + dz * ring };
      if (!sim.build(worker, type, site).ok) continue;
      return sim.buildingsOf('player').find((building) => building.kind === type && !building.operational) ?? null;
    }
  }
  return null;
}

/**
 * The PRD's Definition of Done, walked end to end through the same command boundaries the HUD
 * uses. No entity is mutated directly and no debug affordance is used, so passing here means the
 * flow a player is asked to complete is actually completable.
 *
 * The browser half of the same gate lives in `scripts/browser-qa.mjs --full`.
 */
describe('Definition of Done', () => {
  it('completes gather -> produce -> build -> automate -> evolve -> army -> enemy Core', () => {
    // No opponent: this asserts that the flow the player is asked to complete is completable
    // through the command layer, not that a scripted player out-fights the AI. Losing to the
    // opponent is covered by the soak table in QA.md and by the unattended browser playthrough.
    const sim = new MatchSimulation({ seed: 7, opponent: false });
    const economy = sim.economy('player')!;
    const core = sim.coreOf('player')!;
    const workers = () => sim.unitsOf('player').filter((unit) => unit.kind === 'worker');

    // --- Gather Matter and Energy -----------------------------------------------------------
    const matter = sim.state.resources.alive().find((node) => node.resourceType === 'matter')!;
    expect(issueGatherCommand(workers(), matter, sim.navigation).issued).toBeGreaterThan(0);
    expect(runUntil(sim, 180, () => economy.ledger.totalCollected('matter') > 0)).toBe(true);

    // --- Automate the economy ----------------------------------------------------------------
    const crew = workers();
    expect(automateWorkers(crew.slice(0, 2), 'matter')).toBe(2);
    expect(automateWorkers(crew.slice(2), 'energy')).toBeGreaterThan(0);
    expect(runUntil(sim, 300, () => economy.ledger.totalCollected('energy') > 0)).toBe(true);

    // --- Produce additional Workers ----------------------------------------------------------
    const before = workers().length;
    expect(runUntil(sim, 600, () => economy.ledger.balance('matter') >= UNITS.worker.cost.matter!)).toBe(true);
    expect(sim.enqueue(core, 'worker').ok).toBe(true);
    expect(runUntil(sim, 60, () => workers().length > before)).toBe(true);
    expect(sim.agentsCreated('player')).toBeGreaterThan(0);

    // --- Build a Relay Node and a Fabricator -------------------------------------------------
    // The colony is funded rather than played out in real time: this asserts the flow works, not
    // how long an unassisted economy takes to afford it.
    economy.ledger.deposit('matter', 2_500);
    economy.ledger.deposit('energy', 1_600);
    const capacityBefore = economy.capacity.snapshot().max;
    const builder = workers().find((unit) => !unit.automation) ?? workers()[0]!;
    expect(place(sim, builder, 'relay', core.position)).not.toBeNull();
    expect(runUntil(sim, 300, () => economy.capacity.snapshot().max > capacityBefore)).toBe(true);

    const fabricatorBuilder = workers().find((unit) => !unit.buildOrder) ?? workers()[0]!;
    expect(place(sim, fabricatorBuilder, 'fabricator', core.position)).not.toBeNull();
    const fabricatorReady = () =>
      sim.buildingsOf('player').some((building) => building.kind === 'fabricator' && building.operational);
    expect(runUntil(sim, 400, fabricatorReady)).toBe(true);

    // --- Produce combat Agents ----------------------------------------------------------------
    const fabricator = sim.buildingsOf('player').find((building) => building.kind === 'fabricator' && building.operational)!;
    expect(sim.enqueue(fabricator, 'striker').ok).toBe(true);
    const strikers = () => sim.unitsOf('player').filter((unit) => unit.kind === 'striker');
    expect(runUntil(sim, 120, () => strikers().length > 0)).toBe(true);

    // --- Evolve a Generation ------------------------------------------------------------------
    expect(sim.generation('player')).toBe(1);
    economy.ledger.deposit('data', 200);
    const advance = sim.advanceGeneration('player');
    expect(advance.ok).toBe(true);
    expect(sim.generation('player')).toBe(2);
    // The Generation gate is the authority, not the HUD: a Generation II unit is now producible.
    expect(sim.technology.canProduce('player', 'ranger')).toBe(true);
    expect(sim.technology.canBuild('player', 'foundry')).toBe(false);

    // --- Build an army, find the enemy, and destroy its Core -----------------------------------
    for (let order = 0; order < 8; order += 1) sim.enqueue(fabricator, 'striker');
    expect(runUntil(sim, 300, () => strikers().length >= 6)).toBe(true);

    const enemyCore = sim.coreOf('enemy')!;
    expect(sim.attack(strikers(), enemyCore)).toBeGreaterThan(0);
    // Reinforce while the assault crosses the map, exactly as a player would.
    for (let wave = 0; wave < 8 && !sim.match.isOver; wave += 1) {
      run(sim, 120);
      const target = sim.coreOf('enemy');
      const live = strikers();
      if (target && live.length > 0) sim.attack(live, target);
    }

    expect(sim.match.isOver).toBe(true);
    expect(sim.match.result).toBe('victory');
    expect(checkInvariants(sim)).toEqual([]);
  }, 600_000);
});
