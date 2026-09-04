import { describe, expect, it } from 'vitest';
import { MatchSimulation } from '../match/MatchSimulation';
import { captureSave, parseSave, savedScenario, SAVE_VERSION, type SavedGame } from './SaveGame';

/** Saves the running match and rebuilds it, the way CONTINUE does. */
function roundTrip(sim: MatchSimulation): { save: SavedGame; loaded: MatchSimulation } {
  const save = captureSave(sim, { mode: 'campaign', difficulty: 'standard', seed: 4242 });
  // Through JSON, because that is the only shape a save ever comes back in.
  const parsed = parseSave(JSON.parse(JSON.stringify(save)));
  expect(parsed).not.toBeNull();
  const loaded = new MatchSimulation({ fixture: savedScenario(parsed!), opponent: false, seed: parsed!.seed });
  loaded.restoreState(parsed!);
  return { save, loaded };
}

describe('saving and resuming a match', () => {
  it('restores the colony, the economy, and the clock', () => {
    const sim = new MatchSimulation({ opponent: false, seed: 4242 });
    const economy = sim.economy('player')!;
    economy.ledger.deposit('matter', 900);
    economy.ledger.deposit('energy', 400);
    economy.ledger.deposit('data', 120);
    const worker = sim.unitsOf('player')[0]!;
    // The generated map decides what is clear near the Core, so the site is found, not assumed.
    const placed = [6, 10, 14].some((offset) => [0, 6, -6].some((sideways) =>
      sim.build(worker, 'relay', { x: worker.position.x + offset, z: worker.position.z + sideways }).ok));
    expect(placed).toBe(true);
    sim.run(6);
    expect(sim.enqueue(sim.coreOf('player')!, 'worker').ok).toBe(true);

    const { save, loaded } = roundTrip(sim);

    expect(loaded.elapsedSeconds).toBeCloseTo(sim.elapsedSeconds, 5);
    expect(loaded.unitsOf('player').length).toBe(sim.unitsOf('player').length);
    expect(loaded.buildingsOf('player').length).toBe(sim.buildingsOf('player').length);
    expect(loaded.economy('player')!.ledger.snapshot()).toEqual(economy.ledger.snapshot());
    expect(loaded.economy('player')!.ledger.collectedSnapshot()).toEqual(economy.ledger.collectedSnapshot());
    expect(loaded.economy('player')!.capacity.snapshot().max).toBe(economy.capacity.snapshot().max);
    expect(loaded.generation('player')).toBe(sim.generation('player'));

    // The queued Worker came back on the Core, with its capacity re-reserved for it.
    const workers = loaded.unitsOf('player').length;
    expect(loaded.coreOf('player')!.productionQueue.map((order) => order.unitType)).toEqual(['worker']);
    expect(loaded.economy('player')!.capacity.snapshot().reserved).toBe(1);

    // The half-built Relay comes back mid-construction, and its builder is re-found on the first
    // tick rather than restored, so the site finishes on its own.
    const site = loaded.buildingsOf('player').find((building) => building.kind === 'relay')!;
    expect(site.operational).toBe(false);
    expect(site.constructionProgress).toBeCloseTo(save.buildings.find((entry) => entry.kind === 'relay')!.progress, 5);
    loaded.run(40);
    expect(loaded.buildingsOf('player').find((building) => building.kind === 'relay')!.operational).toBe(true);
    expect(loaded.unitsOf('player').length).toBe(workers + 1);
  });

  it('brings a switched-off synthesis plant back switched off', () => {
    const sim = new MatchSimulation({ opponent: false, seed: 4242 });
    sim.economy('player')!.ledger.deposit('matter', 900);
    sim.economy('player')!.ledger.deposit('energy', 900);
    sim.economy('player')!.ledger.deposit('data', 200);
    // Plants are a Generation II unlock: a colony reaches them the same way it reaches Turrets.
    expect(sim.advanceGeneration('player').ok).toBe(true);
    const worker = sim.unitsOf('player')[0]!;
    const placed = [8, 12, 16].some((offset) => [0, 7, -7].some((sideways) =>
      sim.build(worker, 'reclaimer', { x: worker.position.x + offset, z: worker.position.z + sideways }).ok));
    expect(placed).toBe(true);
    sim.run(60);
    const plant = sim.buildingsOf('player').find((building) => building.kind === 'reclaimer')!;
    expect(plant.operational).toBe(true);
    expect(sim.toggleSynthesis(plant)).toBe(true);

    const { loaded } = roundTrip(sim);

    const restored = loaded.buildingsOf('player').find((building) => building.kind === 'reclaimer')!;
    expect(restored.synthesisPaused).toBe(true);
    // Switched off means switched off: the colony's Energy is untouched a minute later.
    const energy = loaded.economy('player')!.ledger.balance('energy');
    loaded.run(60);
    expect(loaded.economy('player')!.ledger.balance('energy')).toBe(energy);
  });

  it('never re-mints an id a restored entity already holds', () => {
    const sim = new MatchSimulation({ opponent: false, seed: 7 });
    sim.economy('player')!.ledger.deposit('matter', 600);
    sim.enqueue(sim.coreOf('player')!, 'worker');
    sim.run(20);
    const spawned = sim.unitsOf('player').map((unit) => unit.id);

    const { loaded } = roundTrip(sim);
    loaded.economy('player')!.ledger.deposit('matter', 600);
    loaded.enqueue(loaded.coreOf('player')!, 'worker');
    // A duplicate id throws inside the registry, so simply surviving the run is the assertion.
    expect(() => loaded.run(20)).not.toThrow();
    const ids = loaded.unitsOf('player').map((unit) => unit.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(spawned));
  });

  it('refuses a save that does not describe a resumable match', () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave({ version: SAVE_VERSION - 1 })).toBeNull();
    // No player Core: there is no colony to come back to.
    expect(parseSave({ version: SAVE_VERSION, buildings: [], units: [], resources: [] })).toBeNull();
  });

  it('drops entities a build can no longer make sense of', () => {
    const sim = new MatchSimulation({ opponent: false, seed: 11 });
    const save = captureSave(sim, { mode: 'freestyle', difficulty: 'standard', seed: 11 });
    const tampered = JSON.parse(JSON.stringify(save)) as Record<string, unknown>;
    (tampered.units as unknown[]).push({ id: 'ghost-1', kind: 'dragon', team: 'player', x: 0, z: 0, hp: 10 });
    (tampered.units as unknown[]).push({ id: 'not a legal id', kind: 'worker', team: 'player', x: 0, z: 0, hp: 10 });
    const parsed = parseSave(tampered)!;
    expect(parsed).not.toBeNull();
    expect(parsed.units.length).toBe(save.units.length);
    expect(parsed.mode).toBe('freestyle');
  });
});
