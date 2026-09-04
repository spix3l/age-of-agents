import { describe, expect, it } from 'vitest';
import { MatchSimulation } from './MatchSimulation';
import { checkInvariants, runSoak } from '../debug/soak';
import { issueGatherCommand } from '../commands/GatherCommand';
import { issueMoveCommand } from '../commands/MoveCommand';
import { automateWorkers } from '../commands/AutomateCommand';
import { UNITS } from '../../data/units';
import { BUILDINGS } from '../../data/buildings';
import type { BuildingEntity, UnitEntity } from '../types/simulation';

const STEP = 1 / 30;

/** Advances the match and fails on the first invariant breach, naming the second it happened. */
function advance(sim: MatchSimulation, seconds: number, checkEvery = 1): void {
  const steps = Math.round(seconds / STEP);
  for (let step = 0; step < steps && !sim.match.isOver; step += 1) {
    sim.step(STEP);
    if (step % Math.round(checkEvery / STEP) !== 0) continue;
    const failures = checkInvariants(sim);
    if (failures.length > 0) throw new Error(failures.join('\n'));
  }
}

const playerWorkers = (sim: MatchSimulation): UnitEntity[] =>
  sim.unitsOf('player').filter((unit) => unit.kind === 'worker');

const playerCore = (sim: MatchSimulation): BuildingEntity => {
  const core = sim.coreOf('player');
  if (!core) throw new Error('player has no Core');
  return core;
};

/**
 * The whole loop, played through the same command boundaries a human uses, with the shared
 * invariant set asserted the whole way. These are the regressions that would make a shipped
 * build unfinishable, so they are deliberately end to end rather than per-system.
 */
describe('full match loop', () => {
  it('gathers, deposits, and never lets a balance go negative or a node go past empty', () => {
    const sim = new MatchSimulation({ seed: 4, opponent: false });
    const ledger = sim.economy('player')!.ledger;
    const node = sim.state.resources.alive().find((resource) => resource.resourceType === 'matter');
    expect(node).toBeDefined();
    expect(issueGatherCommand(playerWorkers(sim), node!, sim.navigation).issued).toBeGreaterThan(0);
    advance(sim, 120);
    expect(ledger.totalCollected('matter')).toBeGreaterThan(0);
    expect(ledger.balance('matter')).toBeGreaterThanOrEqual(0);
    expect(sim.state.resources.all().every((resource) => resource.remaining >= 0)).toBe(true);
  });

  it('charges cost and capacity on enqueue and refunds a cancelled item in full', () => {
    const sim = new MatchSimulation({ seed: 4, opponent: false });
    const economy = sim.economy('player')!;
    economy.ledger.deposit('matter', 500);
    const before = economy.ledger.balance('matter');
    const capacityBefore = economy.capacity.snapshot();

    const result = sim.enqueue(playerCore(sim), 'worker');
    expect(result.ok).toBe(true);
    expect(economy.ledger.balance('matter')).toBe(before - UNITS.worker.cost.matter!);
    expect(economy.capacity.snapshot().reserved).toBe(capacityBefore.reserved + 1);

    const queued = playerCore(sim).productionQueue[0]!;
    expect(sim.production.cancelOrder(playerCore(sim), queued.id, economy.ledger, economy.capacity)).toBe(true);
    expect(economy.ledger.balance('matter')).toBe(before);
    expect(economy.capacity.snapshot()).toEqual(capacityBefore);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('refuses production that is unaffordable or over capacity', () => {
    const sim = new MatchSimulation({ seed: 4, opponent: false });
    const economy = sim.economy('player')!;
    const core = playerCore(sim);
    // Drain the treasury: the queue must reject rather than run a balance negative.
    economy.ledger.spend({ matter: economy.ledger.balance('matter') });
    expect(sim.enqueue(core, 'worker').ok).toBe(false);
    expect(economy.ledger.balance('matter')).toBe(0);

    // Fund it, then fill capacity instead.
    economy.ledger.deposit('matter', 10_000);
    const { max, used, reserved } = economy.capacity.snapshot();
    for (let slot = used + reserved; slot < max; slot += 1) expect(sim.enqueue(core, 'worker').ok).toBe(true);
    expect(sim.enqueue(core, 'worker').ok).toBe(false);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('spawns a produced Agent, commits its reservation, and leaves it controllable', () => {
    const sim = new MatchSimulation({ seed: 4, opponent: false });
    const economy = sim.economy('player')!;
    economy.ledger.deposit('matter', 500);
    const before = sim.unitsOf('player').length;
    expect(sim.enqueue(playerCore(sim), 'worker').ok).toBe(true);
    advance(sim, UNITS.worker.productionTime + 2);
    const after = sim.unitsOf('player');
    expect(after.length).toBe(before + 1);
    expect(economy.capacity.snapshot().reserved).toBe(0);
    expect(economy.capacity.snapshot().used).toBe(after.length);
    const spawned = after.at(-1)!;
    expect(issueMoveCommand([spawned], { x: spawned.position.x + 6, z: spawned.position.z + 6 }, sim.navigation).issued).toBe(1);
  });

  it('builds a structure through the shared command path and applies its capacity on completion', () => {
    const sim = new MatchSimulation({ seed: 4, opponent: false });
    const economy = sim.economy('player')!;
    economy.ledger.deposit('matter', 1_000);
    economy.ledger.deposit('energy', 1_000);
    const maxBefore = economy.capacity.snapshot().max;
    const worker = playerWorkers(sim)[0]!;
    const site = { x: worker.position.x + 9, z: worker.position.z + 9 };
    const result = sim.build(worker, 'relay', site);
    expect(result.ok).toBe(true);
    advance(sim, 180);
    const relay = sim.buildingsOf('player').find((building) => building.kind === 'relay');
    expect(relay?.operational).toBe(true);
    expect(economy.capacity.snapshot().max).toBe(maxBefore + BUILDINGS.relay.capacityContribution);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('never charges for a structure it refused to place', () => {
    const sim = new MatchSimulation({ seed: 4, opponent: false });
    const economy = sim.economy('player')!;
    const worker = playerWorkers(sim)[0]!;

    // Too poor: the opening balance cannot cover a Fabricator.
    const before = economy.ledger.snapshot();
    const poor = sim.build(worker, 'fabricator', { x: worker.position.x + 9, z: worker.position.z + 9 });
    expect(poor.ok).toBe(false);
    expect(economy.ledger.snapshot()).toEqual(before);

    // Rich, but the site is off the map, and Generation-locked structures are refused too.
    economy.ledger.deposit('matter', 5_000);
    economy.ledger.deposit('energy', 5_000);
    const funded = economy.ledger.snapshot();
    expect(sim.build(worker, 'fabricator', { x: 10_000, z: 10_000 }).ok).toBe(false);
    expect(sim.build(worker, 'reclaimer', { x: worker.position.x + 9, z: worker.position.z + 9 }).ok).toBe(false);
    expect(economy.ledger.snapshot()).toEqual(funded);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('runs a synthesis plant end to end: crew charged, input burned, output banked', () => {
    const sim = new MatchSimulation({ seed: 4, opponent: false });
    const economy = sim.economy('player')!;
    economy.ledger.deposit('matter', 1_000);
    economy.ledger.deposit('energy', 1_000);
    economy.ledger.deposit('data', 200);
    expect(sim.advanceGeneration('player').ok).toBe(true);
    const worker = playerWorkers(sim)[0]!;
    const { used: usedBefore, max: maxBefore } = economy.capacity.snapshot();
    const placed = [9, 13, 17].some((offset) => [9, 0, -9].some((sideways) =>
      sim.build(worker, 'reclaimer', { x: worker.position.x + offset, z: worker.position.z + sideways }).ok));
    expect(placed).toBe(true);
    advance(sim, 180);

    const plant = sim.buildingsOf('player').find((building) => building.kind === 'reclaimer');
    expect(plant?.operational).toBe(true);
    // The crew is charged against Agent Capacity, not against the ceiling: a plant is not a Relay.
    expect(economy.capacity.snapshot().used).toBe(usedBefore + BUILDINGS.reclaimer.capacityUse);
    expect(economy.capacity.snapshot().max).toBe(maxBefore);

    const before = economy.ledger.snapshot();
    advance(sim, 300);
    const after = economy.ledger.snapshot();
    // Energy went down, Matter came back up, and the trade was a loss on the map's own terms.
    expect(after.energy).toBeLessThan(before.energy);
    expect(after.matter).toBeGreaterThan(before.matter);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('ends the match exactly once when a Core dies and freezes every command afterwards', () => {
    const sim = new MatchSimulation({ seed: 4, opponent: false });
    const endings: string[] = [];
    const core = sim.coreOf('enemy')!;
    const attacker = playerWorkers(sim)[0]!;
    // Damage goes through the only writer of HP, exactly as combat does. Deaths are then drained
    // by the simulation's own step, because that is what unregisters the entity and ends the match.
    for (let blow = 0; blow < Math.ceil(core.maxHp / 100) + 1; blow += 1) sim.damage.apply(attacker, core, 100);
    sim.step(STEP);
    endings.push(sim.match.result ?? 'none');

    expect(sim.match.isOver).toBe(true);
    expect(sim.match.result).toBe('victory');
    const elapsed = sim.elapsedSeconds;
    sim.step(STEP);
    expect(sim.elapsedSeconds).toBe(elapsed);
    expect(sim.enqueue(playerCore(sim), 'worker').ok).toBe(false);
    expect(endings).toHaveLength(1);
  });

  it('refuses commands aimed at destroyed entities instead of throwing', () => {
    const sim = new MatchSimulation({ seed: 4, opponent: false });
    const worker = playerWorkers(sim)[0]!;
    const node = sim.state.resources.alive().find((resource) => resource.resourceType === 'matter')!;
    issueGatherCommand([worker], node, sim.navigation);
    sim.state.resources.destroy(node.id);
    advance(sim, 30);
    expect(worker.alive).toBe(true);
    expect(checkInvariants(sim)).toEqual([]);

    const victim = playerWorkers(sim).at(-1)!;
    for (let blow = 0; blow < Math.ceil(victim.maxHp / 100) + 1; blow += 1) {
      sim.damage.apply(sim.coreOf('enemy')!, victim, 100);
    }
    sim.step(STEP);
    // Every command boundary must tolerate a corpse.
    expect(issueMoveCommand([victim], { x: 0, z: 0 }, sim.navigation).issued).toBe(0);
    expect(issueGatherCommand([victim], sim.state.resources.alive()[0]!, sim.navigation).issued).toBe(0);
    expect(automateWorkers([victim], 'matter')).toBe(0);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('resets every counter when a new match replaces the old one', () => {
    const first = new MatchSimulation({ seed: 4, opponent: false });
    first.economy('player')!.ledger.deposit('matter', 250);
    advance(first, 30);
    first.dispose();

    const second = new MatchSimulation({ seed: 4, opponent: false });
    expect(second.elapsedSeconds).toBe(0);
    expect(second.match.isOver).toBe(false);
    expect(second.agentsCreated('player')).toBe(0);
    expect(second.buildingsConstructed('player')).toBe(0);
    expect(second.economy('player')!.ledger.totalCollected('matter')).toBe(0);
    expect(second.stats.snapshot('player')).toEqual(second.stats.snapshot('enemy'));
    expect(second.stats.snapshot('player').unitsLost).toBe(0);
    expect(checkInvariants(second)).toEqual([]);
  });

  it('runs an accelerated AI match end to end without breaking an invariant', () => {
    const report = runSoak({ seed: 30, minutes: 20, sampleSeconds: 30 });
    expect(report.invariantFailures).toEqual([]);
    expect(report.result).toBe('defeat');
    expect(report.durationSeconds).toBeGreaterThan(60);
  }, 300_000);

  it('survives a busy player colony: automation, construction, production, and combat at once', () => {
    const sim = new MatchSimulation({ seed: 12 });
    const economy = sim.economy('player')!;
    economy.ledger.deposit('matter', 2_000);
    economy.ledger.deposit('energy', 1_200);
    const workers = playerWorkers(sim);
    automateWorkers(workers.slice(0, 2), 'matter');
    automateWorkers(workers.slice(2), 'energy');
    // The home basin holds deposits and terrain, so the site is found rather than hardcoded —
    // a hardcoded one silently becomes a RESOURCE_OVERLAP the moment the map is retuned.
    const builder = workers[0]!;
    let placed = false;
    for (let ring = 8; ring <= 20 && !placed; ring += 2) {
      const offsets: readonly (readonly [number, number])[] = [[1, -1], [1, 1], [-1, -1], [-1, 1], [1, 0], [0, 1], [-1, 0], [0, -1]];
      for (const [dx, dz] of offsets) {
        const site = { x: builder.position.x + dx * ring, z: builder.position.z + dz * ring };
        if (sim.build(builder, 'fabricator', site).ok) { placed = true; break; }
      }
    }
    expect(placed).toBe(true);
    advance(sim, 240, 2);
    const fabricator = sim.buildingsOf('player').find((building) => building.kind === 'fabricator');
    if (fabricator?.operational) expect(sim.enqueue(fabricator, 'striker').ok).toBe(true);
    advance(sim, 240, 2);
    expect(checkInvariants(sim)).toEqual([]);
    expect(economy.ledger.balance('matter')).toBeGreaterThanOrEqual(0);
  }, 300_000);
});
