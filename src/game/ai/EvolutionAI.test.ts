import { describe, expect, it } from 'vitest';
import { createBuildingSite } from '../entities/buildings/Building';
import { MatchSimulation } from '../match/MatchSimulation';
import { entityId } from '../types/ids';

describe('AI Generation roster', () => {
  it('collects Data and chooses an upgrade without injected resources', () => {
    const simulation = new MatchSimulation({ seed: 607, scenario: 'economy', opponent: { seed: 607 } });
    simulation.run(480);
    expect(simulation.economy('enemy')!.ledger.totalCollected('data')).toBeGreaterThan(0);
    expect(simulation.generation('enemy')).toBeGreaterThan(1);
  });

  it('uses unlocked Scouts and can complete the Foundry-to-Titan path', () => {
    const simulation = new MatchSimulation({ seed: 606, scenario: 'economy', opponent: { seed: 606 } });
    const core = simulation.coreOf('enemy')!;
    const fabricator = createBuildingSite(
      entityId('enemy-evolution-fabricator'),
      'fabricator',
      'enemy',
      { x: core.position.x - 8, z: core.position.z },
      simulation.unitsOf('enemy')[0]!.id,
    );
    fabricator.operational = true;
    fabricator.constructionProgress = 1;
    fabricator.hp = fabricator.maxHp;
    simulation.state.buildings.add(fabricator);

    const economy = simulation.economy('enemy')!;
    economy.ledger.deposit('matter', 3_000);
    economy.ledger.deposit('energy', 2_000);
    economy.ledger.deposit('data', 500);
    economy.capacity.addProvider(24);
    expect(simulation.advanceGeneration('enemy')).toEqual({ ok: true, generation: 2 });
    expect(simulation.advanceGeneration('enemy')).toEqual({ ok: true, generation: 3 });

    simulation.run(180);
    expect(simulation.unitsOf('enemy').some((unit) => unit.kind === 'scout')).toBe(true);
    expect(simulation.buildingsOf('enemy').some((building) => building.kind === 'foundry' && building.operational)).toBe(true);
    expect(simulation.unitsOf('enemy').some((unit) => unit.kind === 'titan')).toBe(true);
  });
});
