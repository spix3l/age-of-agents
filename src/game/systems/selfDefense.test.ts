import { describe, expect, it } from 'vitest';
import { MatchSimulation } from '../match/MatchSimulation';
import { issueGatherCommand } from '../commands/GatherCommand';
import { createUnitEntity } from '../scenarios/economy';

/** Empty ground in the middle of the map, far from either faction's starting Agents. */
const FIELD = { x: 0, z: 0 };

function arena() {
  return new MatchSimulation({ scenario: 'economy', opponent: false });
}

function place(sim: MatchSimulation, kind: 'worker' | 'striker', team: 'player' | 'enemy', id: string, x: number, z: number) {
  const unit = createUnitEntity(id, kind, team, { x, z });
  sim.state.units.add(unit);
  return unit;
}

describe('self-defense', () => {
  it('lets three Workers fight back against a lone raider instead of being farmed', () => {
    const sim = arena();
    const workers = [0, 1, 2].map((index) => place(sim, 'worker', 'player', `defender-${index}`, FIELD.x, FIELD.z + index * 1.4));
    const raider = place(sim, 'striker', 'enemy', 'lone-raider', FIELD.x + 3, FIELD.z + 1.4);

    sim.run(120);

    // Three Workers are a real deterrent to a lone raider, even though one Worker is not.
    expect(raider.alive).toBe(false);
    expect(workers.filter((worker) => worker.alive).length).toBeGreaterThanOrEqual(1);
  });

  it('still loses a single Worker to a Striker: self-defense is not a free win', () => {
    const sim = arena();
    const worker = place(sim, 'worker', 'player', 'lonely-worker', FIELD.x, FIELD.z);
    const raider = place(sim, 'striker', 'enemy', 'raider-solo', FIELD.x + 2, FIELD.z);

    sim.run(60);

    expect(worker.alive).toBe(false);
    expect(raider.alive).toBe(true);
  });

  it('makes idle Strikers return fire without any order', () => {
    const sim = arena();
    const squad = [0, 1, 2].map((index) => place(sim, 'striker', 'player', `squad-${index}`, FIELD.x, FIELD.z + index * 1.5));
    const raider = place(sim, 'striker', 'enemy', 'raider-2', FIELD.x + 3, FIELD.z + 1.5);

    sim.run(60);

    expect(raider.alive).toBe(false);
    expect(squad.every((unit) => unit.alive)).toBe(true);
  });

  it('never makes a Worker chase its attacker away from its job', () => {
    const sim = arena();
    const worker = place(sim, 'worker', 'player', 'stoic-worker', FIELD.x, FIELD.z);
    const sniper = place(sim, 'striker', 'enemy', 'sniper', FIELD.x + 20, FIELD.z);
    // A hit from out of reach must not drag the Worker across the map.
    sim.damage.apply(sniper, worker, 5);
    const start = { ...worker.position };

    sim.run(20);

    expect(Math.hypot(worker.position.x - start.x, worker.position.z - start.z)).toBeLessThan(2);
    expect(worker.combat.targetId).toBeNull();
  });

  it('resumes a gather trip that combat interrupted instead of mining empty ground', () => {
    const sim = arena();
    const worker = sim.unitsOf('player').find((unit) => unit.kind === 'worker')!;
    // Node ids come from the seeded generator now, so the fixture picks by position, not by name.
    const start = sim.coreOf('player')!.position;
    const node = sim.state.resources.alive()
      .filter((resource) => resource.resourceType === 'matter')
      .sort((a, b) => Math.hypot(a.position.x - start.x, a.position.z - start.z)
        - Math.hypot(b.position.x - start.x, b.position.z - start.z))[0]!;
    const ledger = sim.economy('player')!.ledger;
    expect(issueGatherCommand([worker], node, sim.navigation).issued).toBe(1);

    sim.run(1);
    // Exactly what CombatSystem does when a Worker stops to shoot back.
    worker.path = [];
    worker.pathIndex = 0;
    worker.destination = null;

    sim.run(120);

    expect(worker.gatherOrder).not.toBeNull();
    expect(ledger.collectedSnapshot().matter).toBeGreaterThan(0);
  });
});
