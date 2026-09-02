import { describe, expect, it } from 'vitest';
import { createUnitEntity, type EconomyScenario } from '../scenarios/economy';
import { createBattleScenario } from '../scenarios/battle';
import { entityId } from '../types/ids';
import type { BuildingEntity, UnitEntity } from '../types/simulation';
import { BattleSimulation } from './BattleSimulation';

/** One-sided fixture: only the named team keeps its army, so a Core siege is decisive. */
function undefendedScenario(attacker: 'player' | 'enemy'): EconomyScenario {
  const scenario = createBattleScenario();
  return { ...scenario, units: scenario.units.filter((unit) => unit.team === attacker) };
}

function coreOf(simulation: BattleSimulation, team: 'player' | 'enemy'): BuildingEntity {
  const core = simulation.state.buildings.alive().find((building) => building.team === team && building.kind === 'core');
  if (!core) throw new Error(`Missing ${team} Core`);
  return core;
}

describe('Day 4 battle gate', () => {
  it('produces Victory when the player army destroys the enemy Core', () => {
    const simulation = new BattleSimulation({ scenario: undefendedScenario('player') });
    const core = coreOf(simulation, 'enemy');
    expect(simulation.attack(simulation.unitsOf('player'), core)).toBeGreaterThan(0);
    simulation.run(600);
    expect(core.alive).toBe(false);
    expect(simulation.match.result).toBe('victory');
    expect(simulation.stats.snapshot('player').buildingsDestroyed).toBe(1);
  });

  it('produces Defeat when the enemy army destroys the player Core', () => {
    const simulation = new BattleSimulation({ scenario: undefendedScenario('enemy') });
    const core = coreOf(simulation, 'player');
    expect(simulation.attack(simulation.unitsOf('enemy'), core)).toBeGreaterThan(0);
    simulation.run(600);
    expect(simulation.match.result).toBe('defeat');
    expect(simulation.stats.snapshot('player').buildingsLost).toBe(1);
  });

  it('freezes the simulation once a result is produced', () => {
    const simulation = new BattleSimulation({ scenario: undefendedScenario('player') });
    simulation.attack(simulation.unitsOf('player'), coreOf(simulation, 'enemy'));
    simulation.run(600);
    const elapsed = simulation.state.elapsedSeconds;
    const survivors = simulation.state.units.alive().length;
    simulation.run(60);
    expect(simulation.state.elapsedSeconds).toBe(elapsed);
    expect(simulation.state.units.alive().length).toBe(survivors);
  });

  it('leaves no ghost entities, orphaned targets, or capacity leaks after 100 sequential deaths', () => {
    const scenario = createBattleScenario();
    const simulation = new BattleSimulation({ scenario });
    const economy = simulation.state.economies.get('enemy')!;
    economy.capacity.addProvider(200);
    const executioner = simulation.unitsOf('player')[0]!;
    const fodder: UnitEntity[] = [];
    for (let index = 0; index < 100; index += 1) {
      const victim = createUnitEntity(`fodder-${index}`, 'worker', 'enemy', { x: 20 + (index % 10) * 0.1, z: 20 });
      simulation.state.units.add(victim);
      economy.capacity.reserve(1);
      economy.capacity.commit(1);
      fodder.push(victim);
    }
    const before = economy.capacity.snapshot().used;
    expect(before).toBeGreaterThanOrEqual(100);

    for (const victim of fodder) {
      simulation.damage.apply(executioner, victim, victim.maxHp * 2);
      simulation.step();
    }

    expect(simulation.removed.length).toBe(100);
    expect(simulation.state.units.alive().some((unit) => unit.id.startsWith('fodder'))).toBe(false);
    expect(simulation.state.units.all().some((unit) => !unit.alive)).toBe(false);
    expect(simulation.targets.has(entityId('fodder-0'))).toBe(false);
    expect(economy.capacity.snapshot().used).toBe(before - 100);
    expect(simulation.state.units.alive().every((unit) => (
      unit.combat.targetId === null || simulation.state.units.has(unit.combat.targetId) || simulation.state.buildings.has(unit.combat.targetId)
    ))).toBe(true);
    expect(simulation.damage.pendingDeaths).toBe(0);
  });

  it('lets two mirrored armies fight to a decision without stalling', () => {
    const simulation = new BattleSimulation();
    const playerSquad = simulation.unitsOf('player').filter((unit) => unit.kind === 'striker');
    const enemySquad = simulation.unitsOf('enemy').filter((unit) => unit.kind === 'striker');
    simulation.attack(playerSquad, enemySquad[0]!);
    simulation.attack(enemySquad, playerSquad[0]!);
    simulation.run(120);
    const losses = simulation.stats.snapshot('player').unitsLost + simulation.stats.snapshot('enemy').unitsLost;
    expect(losses).toBeGreaterThan(0);
    expect(simulation.state.units.alive().length).toBeLessThan(16);
  });
});
