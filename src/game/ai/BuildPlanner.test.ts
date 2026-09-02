import { describe, expect, it } from 'vitest';
import { AI } from '../../data/ai';
import { validatePlacement } from '../building/PlacementController';
import { findPath } from '../navigation/AStar';
import { MatchSimulation } from '../match/MatchSimulation';
import { checkInvariants } from '../debug/soak';
import { distance } from './AIKnowledge';

function idleMatch(seed: number) {
  return new MatchSimulation({ seed, scenario: 'economy', opponent: { seed } });
}

describe('AI build planning', () => {
  it('builds capacity and a Fabricator on valid, reachable sites near its Core', () => {
    const simulation = idleMatch(21);
    simulation.run(240);
    const core = simulation.coreOf('enemy')!;
    const built = simulation.buildingsOf('enemy').filter((building) => building.kind !== 'core');
    expect(built.some((building) => building.kind === 'relay')).toBe(true);
    expect(built.some((building) => building.kind === 'fabricator')).toBe(true);

    for (const building of built) {
      expect(distance(building.position, core.position)).toBeLessThanOrEqual(AI.buildRingMax + 4);
      expect(distance(building.position, core.position)).toBeGreaterThan(2);
      const worker = simulation.unitsOf('enemy')[0]!;
      expect(findPath(simulation.navigation, worker.position, core.position).length).toBeGreaterThan(0);
    }
    expect(checkInvariants(simulation)).toEqual([]);
  });

  it('raises maximum capacity before production saturates it', () => {
    const simulation = idleMatch(22);
    simulation.run(300);
    const capacity = simulation.economy('enemy')!.capacity.snapshot();
    expect(capacity.max).toBeGreaterThan(8);
    expect(capacity.used + capacity.reserved).toBeLessThanOrEqual(capacity.max);
  });

  it('rebuilds an essential building that is destroyed', () => {
    const simulation = idleMatch(23);
    simulation.run(240);
    const fabricator = simulation.buildingsOf('enemy').find((building) => building.kind === 'fabricator');
    expect(fabricator).toBeDefined();
    const executioner = simulation.unitsOf('player')[0]!;
    simulation.damage.apply(executioner, fabricator!, fabricator!.maxHp * 2);
    simulation.step();
    expect(simulation.buildingsOf('enemy').some((building) => building.kind === 'fabricator')).toBe(false);

    simulation.run(300);
    expect(simulation.buildingsOf('enemy').some((building) => building.kind === 'fabricator')).toBe(true);
  });

  it('backs off instead of spinning when its base is walled in', () => {
    const simulation = idleMatch(24);
    const core = simulation.coreOf('enemy')!;
    // Block every candidate ring cell so no placement can ever succeed.
    simulation.navigation.setBlockedRect(core.position, { x: (AI.buildRingMax + 6) * 2, z: (AI.buildRingMax + 6) * 2 }, true);
    simulation.run(180);
    const built = simulation.buildingsOf('enemy').filter((building) => building.kind !== 'core');
    expect(built).toHaveLength(0);
    expect(simulation.economy('enemy')!.ledger.snapshot().matter).toBeGreaterThan(0);
    expect(checkInvariants(simulation)).toEqual([]);
  });

  it('only commits placements that pass the same validation a player placement does', () => {
    const simulation = idleMatch(25);
    simulation.run(200);
    for (const building of simulation.buildingsOf('enemy')) {
      if (building.kind === 'core') continue;
      const others = simulation.state.buildings.alive().filter((other) => other.id !== building.id);
      const check = validatePlacement(building.kind, building.position, simulation.navigation, others, simulation.state.resources.alive());
      expect(check.failure ?? 'valid').not.toBe('RESOURCE_OVERLAP');
      expect(check.failure ?? 'valid').not.toBe('BUILDING_OVERLAP');
    }
  });
});
