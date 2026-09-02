import { describe, expect, it } from 'vitest';
import { MatchSimulation } from '../match/MatchSimulation';
import { checkInvariants } from '../debug/soak';
import { desiredWorkers } from '../../data/ai';

function idleMatch(seed = 11) {
  return new MatchSimulation({ seed, scenario: 'economy', opponent: { seed } });
}

describe('AI economy', () => {
  it('puts every idle Worker on automation and grows the Worker count over five minutes', () => {
    const simulation = idleMatch();
    simulation.run(30);
    const workers = simulation.unitsOf('enemy').filter((unit) => unit.kind === 'worker');
    expect(workers.length).toBeGreaterThan(0);
    expect(workers.every((worker) => worker.automation || worker.gatherOrder || worker.buildOrder)).toBe(true);

    simulation.run(270);
    const grown = simulation.unitsOf('enemy').filter((unit) => unit.kind === 'worker');
    expect(grown.length).toBeGreaterThan(3);
    expect(grown.length).toBeLessThanOrEqual(desiredWorkers(simulation.elapsedSeconds) + 2);
  });

  it('splits Workers across Matter and Energy and actually banks both resources', () => {
    const simulation = idleMatch(12);
    simulation.run(240);
    const collected = simulation.economy('enemy')!.ledger.collectedSnapshot();
    expect(collected.matter).toBeGreaterThan(100);
    expect(collected.energy).toBeGreaterThan(20);
  });

  it('never receives free resources: every credit is gathered and every debit is spent', () => {
    const simulation = idleMatch(13);
    const start = 25 + 20;
    simulation.run(300);
    const ledger = simulation.economy('enemy')!.ledger;
    const collected = ledger.collectedSnapshot();
    const balance = ledger.snapshot();
    const spent = start + collected.matter + collected.energy - balance.matter - balance.energy;
    expect(spent).toBeGreaterThan(0);
    expect(balance.matter).toBeGreaterThanOrEqual(0);
    expect(balance.energy).toBeGreaterThanOrEqual(0);
    expect(checkInvariants(simulation)).toEqual([]);
  });

  it('retargets Workers when their resource node is exhausted', () => {
    const simulation = idleMatch(14);
    const node = simulation.state.resources.alive().find((resource) => resource.id.startsWith('enemy') && resource.resourceType === 'matter');
    expect(node).toBeDefined();
    simulation.run(20);
    node!.remaining = 5;
    simulation.run(120);
    expect(node!.alive).toBe(false);
    const workers = simulation.unitsOf('enemy').filter((unit) => unit.kind === 'worker');
    expect(workers.some((worker) => worker.gatherOrder || worker.automation)).toBe(true);
    expect(workers.every((worker) => worker.gatherOrder?.resourceId !== node!.id)).toBe(true);
  });

  it('respects capacity: production is never queued past the Agent limit', () => {
    const simulation = idleMatch(15);
    simulation.run(420);
    const capacity = simulation.economy('enemy')!.capacity.snapshot();
    expect(capacity.used + capacity.reserved).toBeLessThanOrEqual(capacity.max);
  });
});
