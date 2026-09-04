import { describe, expect, it } from 'vitest';
import { SYNTHESIS } from '../../data/synthesis';
import { EconomyLedger } from '../economy/EconomyLedger';
import { Capacity } from '../economy/Capacity';
import { activateCapacityProvider, deactivateCapacityProvider } from '../economy/CapacityProviders';
import { createBuildingSite } from '../entities/buildings/Building';
import { entityId } from '../types/ids';
import type { BuildingEntity } from '../types/simulation';
import { SynthesisSystem } from './SynthesisSystem';

function plant(kind: 'reclaimer' | 'datalab', id = `player-${kind}-test`): BuildingEntity {
  const building = createBuildingSite(entityId(id), kind, 'player', { x: 0, z: 0 }, entityId('builder'));
  building.operational = true;
  building.constructionProgress = 1;
  building.builderId = null;
  return building;
}

/** Runs whole seconds of simulation at the fixed step the match uses. */
function run(system: SynthesisSystem, buildings: readonly BuildingEntity[], seconds: number): void {
  for (let step = 0; step < Math.round(seconds * 30); step += 1) system.update(buildings, 1 / 30);
}

describe('synthesis plants', () => {
  it('converts Energy into Matter at a loss, in whole cycles', () => {
    const ledger = new EconomyLedger({ energy: 100 });
    const system = new SynthesisSystem(() => ledger);
    const reclaimer = plant('reclaimer');
    const recipe = SYNTHESIS.reclaimer!;

    run(system, [reclaimer], 10);
    const matter = ledger.balance('matter');
    const spent = 100 - ledger.balance('energy');

    // Whole cycles only: every unit of output arrived as one batch, paid for in full.
    expect(matter % recipe.amount).toBe(0);
    expect(spent).toBe((matter / recipe.amount) * recipe.input.energy!);
    // Four to five cycles in ten seconds, wherever the plant's id put its opening phase.
    expect(matter).toBeGreaterThanOrEqual(recipe.amount * 4);
    expect(matter).toBeLessThanOrEqual(recipe.amount * 5);
    expect(ledger.totalCollected('matter')).toBe(matter);
  });

  it('waits instead of half-spending when the colony cannot pay', () => {
    const ledger = new EconomyLedger({ energy: 4 });
    const system = new SynthesisSystem(() => ledger);
    const reclaimer = plant('reclaimer');

    run(system, [reclaimer], 20);

    // Exactly one cycle was affordable; the rest of the match it stood waiting.
    expect(ledger.balance('matter')).toBe(SYNTHESIS.reclaimer!.amount);
    expect(ledger.balance('energy')).toBe(0);
    expect(system.status(reclaimer)).toBe('starved');
  });

  it('converts Matter and Energy into Data, the resource a map runs out of first', () => {
    const ledger = new EconomyLedger({ matter: 1_000, energy: 1_000 });
    const system = new SynthesisSystem(() => ledger);
    const lab = plant('datalab');
    const recipe = SYNTHESIS.datalab!;

    run(system, [lab], 30);

    const data = ledger.balance('data');
    expect(data).toBeGreaterThan(0);
    expect(data % recipe.amount).toBe(0);
    expect(1_000 - ledger.balance('matter')).toBe((data / recipe.amount) * recipe.input.matter!);
    expect(1_000 - ledger.balance('energy')).toBe((data / recipe.amount) * recipe.input.energy!);
  });

  it('stops entirely while switched off, and resumes where it left off', () => {
    const ledger = new EconomyLedger({ energy: 200 });
    const system = new SynthesisSystem(() => ledger);
    const reclaimer = plant('reclaimer');

    reclaimer.synthesisPaused = true;
    run(system, [reclaimer], 10);
    expect(ledger.balance('matter')).toBe(0);
    expect(ledger.balance('energy')).toBe(200);
    expect(system.status(reclaimer)).toBe('paused');

    reclaimer.synthesisPaused = false;
    run(system, [reclaimer], 10);
    expect(ledger.balance('matter')).toBeGreaterThan(0);
    expect(system.status(reclaimer)).toBe('running');
  });

  it('does not run a plant that is still a construction site', () => {
    const ledger = new EconomyLedger({ energy: 200 });
    const system = new SynthesisSystem(() => ledger);
    const site = plant('reclaimer');
    site.operational = false;

    run(system, [site], 10);

    expect(ledger.balance('energy')).toBe(200);
    expect(system.status(site)).toBe('offline');
  });

  it('gives every structure at most one cycle of state, and drops it when the plant dies', () => {
    const ledger = new EconomyLedger({ energy: 200 });
    const system = new SynthesisSystem(() => ledger);
    const reclaimer = plant('reclaimer');

    run(system, [reclaimer], 5);
    expect(system.cycleProgress(reclaimer)).toBeLessThanOrEqual(1);

    // The plant is gone: the next update must not keep counting its cycle.
    run(system, [], 1);
    expect(system.cycleProgress(reclaimer)).toBe(0);
  });

  it('charges Agent Capacity while it stands and hands it back when it falls', () => {
    const capacity = new Capacity(10, 4);
    const reclaimer = plant('reclaimer');

    expect(activateCapacityProvider(reclaimer, capacity)).toBe(true);
    expect(capacity.snapshot()).toEqual({ used: 6, reserved: 0, max: 10 });
    // Applied exactly once, however many times completion is reported.
    expect(activateCapacityProvider(reclaimer, capacity)).toBe(false);
    expect(capacity.snapshot().used).toBe(6);

    expect(deactivateCapacityProvider(reclaimer, capacity)).toBe(true);
    expect(capacity.snapshot()).toEqual({ used: 4, reserved: 0, max: 10 });
  });

  it('lets a plant finished at the cap push the colony over it rather than run for free', () => {
    const capacity = new Capacity(8, 8);
    activateCapacityProvider(plant('datalab'), capacity);
    const snapshot = capacity.snapshot();
    expect(snapshot.used).toBe(11);
    expect(capacity.canReserve(1)).toBe(false);
  });
});
